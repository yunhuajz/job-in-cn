import { runOpencli } from '../boss/opencli.js';

type OpencliRunner = (args: string[]) => Promise<unknown>;

// opencli 51job(前程无忧)站点适配器封装 — Boss 风控期间的备用采集源
// 与 boss/bridge.ts 同一模式:复用日常 Chrome,后台窗口执行

const SESSION_ARGS = [
  '--site-session',
  'persistent',
  '--keep-tab',
  'true',
  '--window',
  process.env.OPENCLI_WINDOW ?? 'background',
  '-f',
  'json',
];

export interface Job51Card {
  jobId: string;
  title: string;
  salary: string;
  salaryMin?: number;
  salaryMax?: number;
  city: string;
  district?: string;
  workYear?: string;
  degree?: string;
  company: string;
  companyFull?: string;
  url: string;
  issueDate?: string;
  tags?: string;
}

export async function search51Jobs(
  query: string,
  area: string,
  limit: number,
  page = 1,
  run: OpencliRunner = runOpencli,
): Promise<Job51Card[]> {
  const result = await run([
    '51job',
    'search',
    query,
    '--area',
    area,
    '--limit',
    String(limit),
    '--page',
    String(page),
    ...SESSION_ARGS,
  ]);
  return Array.isArray(result) ? (result as Job51Card[]) : [];
}

// 详情只取 JD 正文;标题/公司等以搜索卡片为准(详情页 title 字段实测不可靠)
export async function get51JobDescription(jobId: string): Promise<string | null> {
  const result = await runOpencli(['51job', 'detail', jobId, ...SESSION_ARGS]);
  if (Array.isArray(result)) {
    const first = result[0] as { description?: unknown } | undefined;
    if (first && typeof first.description === 'string' && first.description.length > 0) {
      return first.description;
    }
  }
  return null;
}
