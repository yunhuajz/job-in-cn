import { z } from 'zod';
import { runOpencli } from './opencli.js';
import type { OpencliRunner } from './bridge.js';
import type { JobRow } from '../jobsync/mcp.js';
import { addHrReply, listJobs } from '../jobsync/mcp.js';

// HR 回复只读捕获(plan.md P3 读侧):chatlist → 匹配库内职位 → chatmsg → Note + hrReplyAt
// 铁律:只读捕获,永不代发任何消息

const chatlistItemSchema = z.object({
  name: z.string(),
  company: z.string(),
  job: z.string(),
  last_msg: z.string(),
  uid: z.string().min(1),
});

const chatmsgItemSchema = z.object({
  from: z.string(),
  type: z.string(),
  text: z.string(),
  time: z.string(),
});

export interface BossConversation {
  hrName: string;
  company: string;
  jobTitle: string;
  lastMsg: string;
  uid: string;
}

export interface BossMessage {
  fromHr: boolean;
  type: string;
  text: string;
  time: Date | null;
}

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

export async function bossChatlist(
  run: OpencliRunner = runOpencli,
): Promise<BossConversation[]> {
  const raw = (await run(['boss', 'chatlist', ...SESSION_ARGS])) as unknown[];
  return raw.map((item) => {
    const parsed = chatlistItemSchema.parse(item);
    return {
      hrName: parsed.name,
      company: parsed.company,
      jobTitle: parsed.job,
      lastMsg: parsed.last_msg,
      uid: parsed.uid,
    };
  });
}

// "2026/7/24 18:21:34" → Date(本地时区);无法解析返回 null
export function parseMessageTime(text: string): Date | null {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(
    text.trim(),
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return new Date(y, mo - 1, d, h, mi, s);
}

export async function bossChatmsg(
  uid: string,
  run: OpencliRunner = runOpencli,
): Promise<BossMessage[]> {
  const raw = (await run([
    'boss',
    'chatmsg',
    uid,
    ...SESSION_ARGS,
  ])) as unknown[];
  return raw.map((item) => {
    const parsed = chatmsgItemSchema.parse(item);
    return {
      fromHr: parsed.from === '对方',
      type: parsed.type,
      text: parsed.text,
      time: parseMessageTime(parsed.time),
    };
  });
}

function normalize(text: string): string {
  return text.replace(/[\s.…]+/g, '').toLowerCase();
}

// 公司名可能被列表截断,做双向前缀匹配;职位名做包含匹配
export function matchConversationToJob(
  conv: BossConversation,
  jobs: JobRow[],
): JobRow | null {
  const convCompany = normalize(conv.company);
  const convTitle = normalize(conv.jobTitle);
  const candidates = jobs.filter((job) => {
    const jobCompany = normalize(job.company);
    const companyHit =
      jobCompany.startsWith(convCompany) || convCompany.startsWith(jobCompany);
    const jobTitle = normalize(job.jobTitle);
    const titleHit = jobTitle.includes(convTitle) || convTitle.includes(jobTitle);
    return companyHit && titleHit;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export interface ReplySyncDeps {
  chatlist: () => Promise<BossConversation[]>;
  chatmsg: (uid: string) => Promise<BossMessage[]>;
  listJobs: () => Promise<Array<JobRow & { hrReplyAt?: string | null }>>;
  addHrReply: (
    jobId: string,
    content: string,
    repliedAt?: Date,
  ) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
}

export interface ReplySyncReport {
  conversations: number;
  matched: number;
  captured: number;
  alreadyRecorded: number;
  unmatched: Array<{ company: string; jobTitle: string }>;
  errors: Array<{ company: string; message: string }>;
}

const defaultDeps: ReplySyncDeps = {
  chatlist: () => bossChatlist(),
  chatmsg: (uid) => bossChatmsg(uid),
  listJobs: () => listJobs(50),
  addHrReply: (jobId, content, repliedAt) =>
    addHrReply(jobId, content, repliedAt),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

const CHAT_INTERVAL_MS = 2000;

export async function syncHrReplies(
  deps: ReplySyncDeps = defaultDeps,
): Promise<ReplySyncReport> {
  const [conversations, jobs] = await Promise.all([
    deps.chatlist(),
    deps.listJobs(),
  ]);
  const report: ReplySyncReport = {
    conversations: conversations.length,
    matched: 0,
    captured: 0,
    alreadyRecorded: 0,
    unmatched: [],
    errors: [],
  };
  for (const conv of conversations) {
    const job = matchConversationToJob(conv, jobs);
    if (!job) {
      report.unmatched.push({
        company: conv.company,
        jobTitle: conv.jobTitle,
      });
      continue;
    }
    report.matched += 1;
    if (job.hrReplyAt) {
      report.alreadyRecorded += 1;
      continue;
    }
    try {
      const messages = await deps.chatmsg(conv.uid);
      const hrTexts = messages.filter((m) => m.fromHr && m.type === '文本');
      if (hrTexts.length === 0) {
        continue;
      }
      const content = [
        `【HR 回复原文捕获 · ${conv.hrName} @ ${conv.company}】`,
        ...hrTexts.map((m) => m.text),
      ].join('\n');
      const lastTime = hrTexts[hrTexts.length - 1].time ?? undefined;
      await deps.addHrReply(job.id, content, lastTime);
      report.captured += 1;
    } catch (error) {
      report.errors.push({
        company: conv.company,
        message: (error as Error).message,
      });
    }
    await deps.sleep(CHAT_INTERVAL_MS);
  }
  return report;
}
