import type { AddJobInput } from '../boss/map.js';
import { crawlerConfigSchema, crawlerPlanSchema, matchesPreferences, type CrawlerConfig, type CrawlerPlan, type Platform } from './config.js';

export interface CrawlSearchGroup {
  round: number;
  index: number;
  query: string;
  city: string;
}

export interface CrawlResumePoint {
  round: number;
  index: number;
}

export interface CrawlCheckpoint {
  plan: CrawlerPlan;
  configs: CrawlerConfig[];
  next: CrawlResumePoint;
}

export interface CrawlPlanState {
  status: 'idle' | 'running' | 'paused' | 'stopping' | 'stopped' | 'completed' | 'failed';
  plan?: CrawlerPlan;
  platform?: Platform;
  round?: number;
  group?: CrawlSearchGroup;
  startedAt?: string;
  endedAt?: string;
  pauseUntil?: string;
  blockedPlatforms?: Partial<Record<Platform, string>>;
  visited: number;
  added: number;
  duplicates: number;
  skipped: number;
  errors: number;
  logs: string[];
}

export type GroupSource = (config: CrawlerConfig, group: CrawlSearchGroup, signal: AbortSignal, log: (text: string) => void) => AsyncIterable<AddJobInput>;
export type GroupWaiter = (signal: AbortSignal, log: (text: string) => void) => Promise<void>;

export class CrawlPlanRun {
  private state: CrawlPlanState = { status: 'idle', visited: 0, added: 0, duplicates: 0, skipped: 0, errors: 0, logs: [] };
  private controller?: AbortController;
  private task: Promise<void> = Promise.resolve();
  private resumeWaiter?: () => void;
  private pauseTimer?: ReturnType<typeof setTimeout>;
  private checkpoint?: Omit<CrawlCheckpoint, 'next'>;

  constructor(private source: GroupSource, private waitBetweenGroups: GroupWaiter = async () => {}, private saveCheckpoint?: (checkpoint: CrawlCheckpoint | undefined) => void) {}

  snapshot(): CrawlPlanState { return structuredClone(this.state); }
  finished(): Promise<void> { return this.task; }

  start(input: unknown, rawConfigs: unknown[], save: (job: AddJobInput) => Promise<{ created: boolean }>, resume?: CrawlResumePoint): void {
    if (this.state.status === 'running' || this.state.status === 'stopping') throw new Error('正在采集，请先停止当前任务');
    const plan = crawlerPlanSchema.parse(input);
    const configs = rawConfigs.map((config) => crawlerConfigSchema.parse(config));
    const byPlatform = new Map(configs.map((config) => [config.platform, config]));
    for (const platform of plan.platforms) if (!byPlatform.has(platform)) throw new Error(`缺少${platform}的采集配置`);
    this.controller = new AbortController();
    this.checkpoint = { plan, configs };
    this.writeCheckpoint(resume ?? { round: 1, index: 0 });
    this.state = { status: 'running', plan, startedAt: new Date().toISOString(), visited: 0, added: 0, duplicates: 0, skipped: 0, errors: 0, logs: [], blockedPlatforms: {} };
    this.task = this.execute(plan, byPlatform, this.controller.signal, save, resume);
  }

  stop(): void {
    if (this.state.status !== 'running' && this.state.status !== 'paused') return;
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.state.status = 'stopping';
    this.resumeWaiter?.();
    this.resumeWaiter = undefined;
    this.log('正在停止：等待当前浏览器操作结束，不再采集下一条。');
    this.controller?.abort();
  }

  pauseFor(hours: 1 | 2): void {
    if (this.state.status !== 'running') return;
    const milliseconds = hours * 60 * 60 * 1000;
    this.state.status = 'paused';
    this.state.pauseUntil = new Date(Date.now() + milliseconds).toISOString();
    this.log(`已暂停 ${hours} 小时：当前浏览器操作完成后不再开始下一条。`);
    this.pauseTimer = setTimeout(() => this.resume(), milliseconds);
  }

  resume(): void {
    const hasBlockedPlatforms = Object.keys(this.state.blockedPlatforms ?? {}).length > 0;
    if (this.state.status !== 'paused' && !hasBlockedPlatforms) return;
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = undefined;
    if (this.state.status === 'paused') this.state.status = 'running';
    this.state.pauseUntil = undefined;
    this.state.blockedPlatforms = {};
    this.log(hasBlockedPlatforms ? '已恢复暂停的平台，继续采集。' : '暂停结束，继续采集。');
    this.resumeWaiter?.();
    this.resumeWaiter = undefined;
  }

  private log = (text: string): void => {
    this.state.logs.push(`${new Date().toLocaleTimeString('zh-CN')} ${text}`);
    this.state.logs = this.state.logs.slice(-200);
  };

  private async execute(plan: CrawlerPlan, configs: Map<Platform, CrawlerConfig>, signal: AbortSignal, save: (job: AddJobInput) => Promise<{ created: boolean }>, resume?: CrawlResumePoint) {
    try {
      const groups = new Map(plan.platforms.map((platform) => [platform, this.groupsFor(configs.get(platform)!)]));
      const groupCount = Math.max(...[...groups.values()].map((items) => items.length));
      for (let round = resume?.round ?? 1; round <= plan.rounds; round += 1) {
        for (let index = round === resume?.round ? resume.index : 0; index < groupCount; index += 1) {
          for (const platform of plan.platforms) {
            if (signal.aborted) return;
            const group = groups.get(platform)![index];
            if (!group) continue;
            const config = configs.get(platform)!;
            const current = { ...group, round, index };
            if (this.state.blockedPlatforms?.[platform]) continue;
            this.state.platform = platform;
            this.state.round = round;
            this.state.group = current;
            this.writeCheckpoint({ round, index });
            this.log(`第 ${round}/${plan.rounds} 轮：${platform} · ${current.query} · ${current.city}`);
            try {
              const iterator = this.source(config, current, signal, this.log)[Symbol.asyncIterator]();
              while (true) {
                await this.waitWhilePaused(signal);
                if (signal.aborted) return;
                const next = await iterator.next();
                if (next.done) break;
                await this.waitWhilePaused(signal);
                if (signal.aborted) return;
                const job = next.value;
                this.state.visited += 1;
                if (!matchesPreferences({ salary: job.salaryRange, location: job.location, description: job.jobDescription }, config)) {
                  this.state.skipped += 1;
                  continue;
                }
                const result = await save(job);
                if (result.created) this.state.added += 1;
                else this.state.duplicates += 1;
              }
            } catch (error) {
              if (signal.aborted) return;
              const message = error instanceof Error ? error.message : String(error);
              if (!needsUserCheck(message)) throw error;
              this.state.errors += 1;
              this.state.blockedPlatforms = { ...this.state.blockedPlatforms, [platform]: message };
              this.log(`${platform} 已暂停：${message}`);
            }
            if (this.hasNextGroup(plan, groups, round, index, platform)) await this.waitBetweenGroups(signal, this.log);
          }
        }
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
      if (this.state.status === 'completed') this.saveCheckpoint?.(undefined);
    }
  }

  private groupsFor(config: CrawlerConfig): Omit<CrawlSearchGroup, 'round' | 'index'>[] {
    return [...new Set(config.keywords)].flatMap((query) => [...new Set(config.cities)].map((city) => ({ query, city })));
  }

  private hasNextGroup(plan: CrawlerPlan, groups: Map<Platform, Omit<CrawlSearchGroup, 'round' | 'index'>[]>, round: number, index: number, platform: Platform): boolean {
    const platformIndex = plan.platforms.indexOf(platform);
    if (plan.platforms.slice(platformIndex + 1).some((item) => Boolean(groups.get(item)?.[index]))) return true;
    const groupCount = Math.max(...[...groups.values()].map((items) => items.length));
    return index + 1 < groupCount || round < plan.rounds;
  }

  private async waitWhilePaused(signal: AbortSignal): Promise<void> {
    while (this.state.status === 'paused' && !signal.aborted) {
      await new Promise<void>((resolve) => { this.resumeWaiter = resolve; });
    }
  }

  private writeCheckpoint(next: CrawlResumePoint): void {
    if (this.checkpoint) this.saveCheckpoint?.({ ...this.checkpoint, next });
  }
}

function needsUserCheck(message: string): boolean {
  return /验证|滑块|slider|验证码|账号异常|存在风险|风险|登录|security/i.test(message);
}
