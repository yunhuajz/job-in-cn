import { bossDetail, bossSearch, type BossSearchOptions } from './bridge.js';
import {
  toAddJobInput,
  type AddJobInput,
  type BossJobCard,
  type BossJobDetail,
} from './map.js';
import { addJob, type AddJobResult } from '../jobsync/mcp.js';

// 去重 + 落库管道(plan.md 1.6):搜索 → 逐条详情 → add_job(URL 服务端去重)

export interface HarvestDeps {
  search: (options: BossSearchOptions) => Promise<BossJobCard[]>;
  detail: (securityId: string) => Promise<BossJobDetail>;
  addJob: (input: AddJobInput) => Promise<AddJobResult>;
  sleep: (ms: number) => Promise<void>;
}

export interface HarvestItemError {
  jobId: string;
  title: string;
  message: string;
}

export interface HarvestReport {
  added: Array<{ jobId: string; title: string; jobSyncId: string }>;
  duplicates: Array<{ jobId: string; title: string }>;
  errors: HarvestItemError[];
}

const defaultDeps: HarvestDeps = {
  search: (options) => bossSearch(options),
  detail: (securityId) => bossDetail(securityId),
  addJob: (input) => addJob(input),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

// 读侧也保持克制节奏,详情请求之间留间隔
const DETAIL_INTERVAL_MS = 1500;

export async function harvestJobs(
  options: BossSearchOptions,
  deps: HarvestDeps = defaultDeps,
): Promise<HarvestReport> {
  const cards = await deps.search(options);
  const report: HarvestReport = { added: [], duplicates: [], errors: [] };
  for (const card of cards) {
    let detail: BossJobDetail | null = null;
    try {
      detail = await deps.detail(card.securityId);
    } catch (error) {
      // 详情失败不中断整批:记 error,仍用卡片快照落库
      report.errors.push({
        jobId: card.jobId,
        title: card.title,
        message: `详情获取失败:${(error as Error).message}`,
      });
    }
    try {
      const result = await deps.addJob(toAddJobInput(card, detail));
      if (result.created && result.jobId) {
        report.added.push({
          jobId: card.jobId,
          title: card.title,
          jobSyncId: result.jobId,
        });
      } else {
        report.duplicates.push({ jobId: card.jobId, title: card.title });
      }
    } catch (error) {
      report.errors.push({
        jobId: card.jobId,
        title: card.title,
        message: `落库失败:${(error as Error).message}`,
      });
    }
    await deps.sleep(DETAIL_INTERVAL_MS);
  }
  return report;
}
