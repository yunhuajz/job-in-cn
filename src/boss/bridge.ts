import { runOpencli } from './opencli.js';
import {
  toJobCard,
  toJobDetail,
  type BossJobCard,
  type BossJobDetail,
} from './map.js';

// opencli boss 站点适配器封装(plan.md 1.3)
// 适配器经 Browser Bridge 扩展复用日常 Chrome 的登录态,主动打开标签页采集

const BOSS_JOBS_URL = 'https://www.zhipin.com/web/geek/jobs';
// 后台窗口执行(opencli --window background):采集不再抢占用户可见的 Chrome 窗口,
// 适配器每条详情都会 page.goto 一次,前台模式下表现为"网页一直刷新"
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

export type OpencliRunner = (args: string[]) => Promise<unknown>;

export interface BossSearchOptions {
  query?: string;
  city?: string;
  experience?: string;
  limit?: number;
  page?: number;
}

// 标签页租约过期时重建会话再重试一次(实测间歇出现 stale page identity)
async function withSessionRecovery<T>(
  run: OpencliRunner,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!/stale page identity|Page not found/i.test(String(error))) {
      throw error;
    }
    await run(['browser', 'default', 'tab', 'new', BOSS_JOBS_URL]);
    return fn();
  }
}

export async function bossWhoami(
  run: OpencliRunner = runOpencli,
): Promise<{ loggedIn: boolean; userType: string }> {
  const raw = await withSessionRecovery(run, () =>
    run(['boss', 'whoami', '-f', 'json']),
  );
  const data = raw as { logged_in?: boolean; user_type?: string };
  return {
    loggedIn: data.logged_in === true,
    userType: data.user_type ?? '',
  };
}

export async function bossSearch(
  options: BossSearchOptions,
  run: OpencliRunner = runOpencli,
): Promise<BossJobCard[]> {
  const args = ['boss', 'search'];
  if (options.query) args.push(options.query);
  if (options.city) args.push('--city', options.city);
  if (options.experience) args.push('--experience', options.experience);
  if (options.limit) args.push('--limit', String(options.limit));
  if (options.page) args.push('--page', String(options.page));
  args.push(...SESSION_ARGS);
  const raw = await withSessionRecovery(run, () => run(args));
  return (raw as unknown[]).map(toJobCard);
}

export async function bossDetail(
  securityId: string,
  run: OpencliRunner = runOpencli,
): Promise<BossJobDetail> {
  const raw = await withSessionRecovery(run, () =>
    run(['boss', 'detail', securityId, ...SESSION_ARGS]),
  );
  const items = raw as unknown[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`boss detail 返回空:${securityId.slice(0, 24)}…`);
  }
  return toJobDetail(items[0]);
}
