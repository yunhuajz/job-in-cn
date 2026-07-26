import { runOpencli } from './opencli.js';

// P3 写侧:求职端「立即沟通」一键发送 Boss 预存常用语(plan.md §3)
// 铁律:只投「已批准」职位;人化频率 ≤20 条/天、间隔 30s–3min、仅 9:00–21:00;
// 检测到验证码/风控立即熔断,当天停投。

export const DAILY_GREET_LIMIT = 20;
export const SEND_WINDOW_START_HOUR = 9;
export const SEND_WINDOW_END_HOUR = 21;
export const MIN_DELAY_MS = 30_000;
export const MAX_DELAY_MS = 180_000;
export const MAX_CONSECUTIVE_FAILURES = 2;

const RISK_CONTROL_PATTERN =
  /安全验证|滑块|拖动下方滑块|请完成验证|账号异常|操作频繁|存在风险|security.?check/i;

export const APPROVED_STATUS_LABEL = '已批准';

export interface GreetCandidate {
  id: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
}

export function isWithinSendWindow(now: Date): boolean {
  const hour = now.getHours();
  return hour >= SEND_WINDOW_START_HOUR && hour < SEND_WINDOW_END_HOUR;
}

export function pickDelayMs(rand: () => number = Math.random): number {
  return MIN_DELAY_MS + Math.floor(rand() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

export function detectRiskControl(pageText: string): boolean {
  return RISK_CONTROL_PATTERN.test(pageText);
}

export type GreetOutcome =
  | 'sent'
  | 'already-communicated'
  | 'no-button'
  | 'risk-control'
  | 'failed';

// 浏览器与落库动作全部经 IO 注入,核心流程可纯单测
export interface GreetIO {
  openJobPage(url: string): Promise<void>;
  // 返回页面信号文本(URL + 标题 + 可交互元素),用于风控识别
  readPageSignals(): Promise<string>;
  // 找到可见的「立即沟通」按钮并点击;返回点击结果
  clickChatButton(): Promise<'clicked' | 'already' | 'missing'>;
  // 点击后验证沟通已建立(按钮变为「继续沟通」或聊天框出现)
  verifyChatOpened(): Promise<boolean>;
  markSent(jobId: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  now(): Date;
}

export interface GreetItemResult {
  candidate: GreetCandidate;
  outcome: GreetOutcome;
  detail?: string;
}

export interface GreetReport {
  results: GreetItemResult[];
  sent: number;
  stoppedBy: 'risk-control' | 'window-closed' | 'failures' | 'completed';
}

export async function greetOne(
  candidate: GreetCandidate,
  io: GreetIO,
): Promise<GreetOutcome> {
  await io.openJobPage(candidate.jobUrl);
  const signals = await io.readPageSignals();
  if (detectRiskControl(signals)) return 'risk-control';

  const click = await io.clickChatButton();
  if (click === 'already') return 'already-communicated';
  if (click === 'missing') return 'no-button';

  await io.sleep(2_000);
  const opened = await io.verifyChatOpened();
  if (!opened) return 'failed';

  await io.markSent(candidate.id);
  return 'sent';
}

export async function runGreetingBatch(
  candidates: GreetCandidate[],
  io: GreetIO,
  rand: () => number = Math.random,
): Promise<GreetReport> {
  const results: GreetItemResult[] = [];
  let sent = 0;
  let consecutiveFailures = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (!isWithinSendWindow(io.now())) {
      return { results, sent, stoppedBy: 'window-closed' };
    }

    let outcome: GreetOutcome;
    try {
      outcome = await greetOne(candidate, io);
      results.push({ candidate, outcome });
    } catch (error) {
      outcome = 'failed';
      results.push({
        candidate,
        outcome,
        detail: (error as Error).message,
      });
    }

    if (outcome === 'risk-control') {
      return { results, sent, stoppedBy: 'risk-control' };
    }
    if (outcome === 'sent') {
      sent += 1;
      consecutiveFailures = 0;
    } else if (outcome === 'failed') {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        return { results, sent, stoppedBy: 'failures' };
      }
    } else {
      consecutiveFailures = 0;
    }

    const isLast = i === candidates.length - 1;
    if (!isLast) await io.sleep(pickDelayMs(rand));
  }

  return { results, sent, stoppedBy: 'completed' };
}

// ---- 真实浏览器 IO(opencli browser default 会话,经 Browser Bridge 扩展)----

interface FindEntry {
  nth?: number;
  text?: string;
  visible?: boolean;
}

interface FindResult {
  matches_n: number;
  entries: FindEntry[];
}

const CHAT_BUTTON_CSS = 'a.btn-startchat';

async function findChatButtons(): Promise<FindEntry[]> {
  const raw = (await runOpencli([
    'browser',
    'default',
    'find',
    '--css',
    CHAT_BUTTON_CSS,
  ])) as FindResult;
  return raw.entries ?? [];
}

export function createOpencliGreetIO(
  markSent: (jobId: string) => Promise<void>,
): GreetIO {
  return {
    async openJobPage(url) {
      await runOpencli(['browser', 'default', 'open', url]);
    },
    async readPageSignals() {
      const raw = await runOpencli(['browser', 'default', 'state']);
      return typeof raw === 'string' ? raw : JSON.stringify(raw);
    },
    async clickChatButton() {
      const entries = await findChatButtons();
      const visible = entries.filter((e) => e.visible);
      if (visible.length === 0) return 'missing';
      if (visible.some((e) => (e.text ?? '').includes('继续沟通'))) {
        return 'already';
      }
      const start = visible.find((e) => (e.text ?? '').includes('立即沟通'));
      if (!start) return 'missing';
      await runOpencli([
        'browser',
        'default',
        'click',
        CHAT_BUTTON_CSS,
        '--nth',
        String(start.nth ?? 0),
      ]);
      return 'clicked';
    },
    async verifyChatOpened() {
      const entries = await findChatButtons();
      return entries.some(
        (e) => e.visible && (e.text ?? '').includes('继续沟通'),
      );
    },
    markSent,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
  };
}
