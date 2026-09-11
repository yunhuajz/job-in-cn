import { runOpencli } from '../boss/opencli.js';

type OpencliRunner = (args: string[]) => Promise<unknown>;
const JOB51_SEARCH_URL = 'https://we.51job.com/pc/search';

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

async function withSessionRecovery<T>(run: OpencliRunner, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!/stale page identity|Page not found/i.test(String(error))) throw error;
    await run(['browser', 'default', 'tab', 'new', JOB51_SEARCH_URL]);
    return action();
  }
}

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
  experienceOrRun?: string | OpencliRunner,
  runner?: OpencliRunner,
): Promise<Job51Card[]> {
  const experience = typeof experienceOrRun === 'string' ? experienceOrRun : undefined;
  const run = typeof experienceOrRun === 'function' ? experienceOrRun : (runner ?? runOpencli);
  const args = [
    '51job',
    'search',
    query,
    '--area',
    area,
    '--limit',
    String(limit),
    '--page',
    String(page),
  ];
  if (experience) args.push('--experience', experience);
  args.push(...SESSION_ARGS);
  const result = await withSessionRecovery(run, () => run(args));
  return Array.isArray(result) ? (result as Job51Card[]) : [];
}

// 详情只取 JD 正文;标题/公司等以搜索卡片为准(详情页 title 字段实测不可靠)
export async function get51JobDescription(jobId: string, run: OpencliRunner = runOpencli): Promise<string | null> {
  let result: unknown;
  try {
    result = await withSessionRecovery(run, () => run(['51job', 'detail', jobId, ...SESSION_ARGS]));
  } catch (error) {
    // 详情标签页连续失效时保留搜索卡片，不能因此终止整夜采集。
    if (/stale page identity|Page not found/i.test(String(error))) return null;
    throw error;
  }
  if (Array.isArray(result)) {
    const first = result[0] as { description?: unknown } | undefined;
    if (first && typeof first.description === 'string' && first.description.length > 0) {
      return first.description;
    }
  }
  return null;
}
