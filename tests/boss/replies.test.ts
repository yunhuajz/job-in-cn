import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  matchConversationToJob,
  parseMessageTime,
  syncHrReplies,
  type BossConversation,
  type ReplySyncDeps,
} from '../../src/boss/replies.js';
import type { JobRow } from '../../src/jobsync/mcp.js';

const chatmsgFixture = JSON.parse(
  readFileSync(resolve('tests/fixtures/boss/chatmsg.json'), 'utf8'),
) as Array<{ from: string; type: string; text: string; time: string }>;

const conv: BossConversation = {
  hrName: '高云鹤',
  company: '北京十环',
  jobTitle: '业务场景AI工程师（智能体开发方向）',
  lastMsg: '问一下，薪资能给到 7.5k 吗',
  uid: 'uid-1',
};

const jobs: JobRow[] = [
  {
    id: 'job-1',
    jobTitle: '业务场景AI工程师（智能体开发方向）',
    company: '北京十环科技有限公司',
    city: '北京',
    salary: '10-15K',
    matchScore: null,
    weekendRestStatus: 'none',
    hrReplyAt: null,
    status: 'Draft',
  },
  {
    id: 'job-2',
    jobTitle: 'AI Agent 工程师',
    company: '考试星',
    city: '北京',
    salary: '25-35K',
    matchScore: 76,
    weekendRestStatus: 'none',
    hrReplyAt: null,
    status: 'Draft',
  },
];

describe('parseMessageTime', () => {
  it('解析 Boss 消息时间格式', () => {
    const date = parseMessageTime('2026/7/24 18:21:34');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getHours()).toBe(18);
  });

  it('非法格式返回 null', () => {
    expect(parseMessageTime('昨天')).toBeNull();
    expect(parseMessageTime('07月24日')).toBeNull();
  });
});

describe('matchConversationToJob', () => {
  it('公司名截断也能双向前缀匹配', () => {
    expect(matchConversationToJob(conv, jobs)?.id).toBe('job-1');
  });

  it('公司不匹配返回 null', () => {
    expect(
      matchConversationToJob({ ...conv, company: '不存在的公司' }, jobs),
    ).toBeNull();
  });

  it('公司匹配但职位不匹配返回 null', () => {
    expect(
      matchConversationToJob(
        { ...conv, jobTitle: '完全另一个岗位' },
        [
          {
            ...jobs[0],
            jobTitle: '业务场景AI工程师（智能体开发方向）',
            id: 'a',
          },
        ],
      ),
    ).toBeNull();
  });
});

describe('syncHrReplies', () => {
  function makeDeps(overrides: Partial<ReplySyncDeps> = {}): ReplySyncDeps {
    return {
      chatlist: async () => [conv],
      chatmsg: async () =>
        chatmsgFixture.map((m) => ({
          fromHr: m.from === '对方',
          type: m.type,
          text: m.text,
          time: parseMessageTime(m.time),
        })),
      listJobs: async () => jobs,
      addHrReply: async () => {},
      sleep: async () => {},
      ...overrides,
    };
  }

  it('匹配的会话:HR 文本消息合成 Note,hrReplyAt 取最后一条时间', async () => {
    let captured: { jobId: string; content: string; repliedAt?: Date } | null =
      null;
    const report = await syncHrReplies(
      makeDeps({
        addHrReply: async (jobId, content, repliedAt) => {
          captured = { jobId, content, repliedAt };
        },
      }),
    );
    expect(report.captured).toBe(1);
    expect(captured!.jobId).toBe('job-1');
    expect(captured!.content).toContain('你好，我把你简历给领导看了');
    expect(captured!.content).not.toContain('我想从开发做起'); // 自己的消息不进
    expect(captured!.content).not.toContain('"action"'); // 招呼卡片不进
    expect(captured!.repliedAt?.getHours()).toBe(16);
  });

  it('已有 hrReplyAt 的职位跳过(幂等)', async () => {
    const report = await syncHrReplies(
      makeDeps({
        listJobs: async () => [
          { ...jobs[0], hrReplyAt: '2026-07-25T10:00:00Z' },
        ],
      }),
    );
    expect(report.captured).toBe(0);
    expect(report.alreadyRecorded).toBe(1);
  });

  it('匹配不到的会话计入 unmatched,不报错', async () => {
    const report = await syncHrReplies(
      makeDeps({ listJobs: async () => [] }),
    );
    expect(report.unmatched).toHaveLength(1);
    expect(report.errors).toHaveLength(0);
  });
});
