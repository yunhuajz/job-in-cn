import type { AddJobInput } from '../boss/map.js';
import { crawlerConfigSchema, matchesPreferences, type CrawlerConfig } from './config.js';

export interface RunState {
  status: 'idle' | 'running' | 'stopping' | 'stopped' | 'completed' | 'failed';
  config?: CrawlerConfig;
  startedAt?: string;
  endedAt?: string;
  visited: number;
  added: number;
  duplicates: number;
  skipped: number;
  errors: number;
  logs: string[];
}
export type JobSource = (config: CrawlerConfig, signal: AbortSignal, log: (text: string) => void) => AsyncIterable<AddJobInput>;

export class CrawlRun {
  private state: RunState = { status: 'idle', visited: 0, added: 0, duplicates: 0, skipped: 0, errors: 0, logs: [] };
  private controller?: AbortController;
  private task: Promise<void> = Promise.resolve();

  constructor(private source: JobSource) {}

  snapshot(): RunState { return structuredClone(this.state); }
  finished(): Promise<void> { return this.task; }

  start(input: unknown, save: (job: AddJobInput) => Promise<{ created: boolean }>): void {
    if (this.state.status === 'running' || this.state.status === 'stopping') throw new Error('正在采集，请先停止当前任务');
    const config = crawlerConfigSchema.parse(input);
    this.controller = new AbortController();
    this.state = { status: 'running', config, startedAt: new Date().toISOString(), visited: 0, added: 0, duplicates: 0, skipped: 0, errors: 0, logs: [] };
    this.task = this.execute(config, this.controller.signal, save);
  }

  stop(): void {
    if (this.state.status !== 'running') return;
    this.state.status = 'stopping';
    this.log('正在停止：等待当前浏览器操作结束，不再采集下一条。');
    this.controller?.abort();
  }

  private log = (text: string): void => {
    this.state.logs.push(`${new Date().toLocaleTimeString('zh-CN')} ${text}`);
    this.state.logs = this.state.logs.slice(-200);
  };

  private async execute(config: CrawlerConfig, signal: AbortSignal, save: (job: AddJobInput) => Promise<{ created: boolean }>) {
    try {
      for await (const job of this.source(config, signal, this.log)) {
        if (signal.aborted) break;
        this.state.visited += 1;
        if (!matchesPreferences({ salary: job.salaryRange, location: job.location, description: job.jobDescription }, config)) {
          this.state.skipped += 1;
          this.log(`条件不符：${job.jobTitle}`);
          continue;
        }
        const result = await save(job);
        if (result.created) this.state.added += 1;
        else this.state.duplicates += 1;
        this.log(`${result.created ? '新增' : '重复跳过'}：${job.jobTitle}`);
      }
      this.state.status = signal.aborted ? 'stopped' : 'completed';
    } catch (error) {
      this.state.status = signal.aborted ? 'stopped' : 'failed';
      if (!signal.aborted) {
        this.state.errors += 1;
        this.log(`采集停止：${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      this.state.endedAt = new Date().toISOString();
    }
  }
}
