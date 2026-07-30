import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AddJobInput } from '../boss/map.js';

// jobsync MCP HTTP 客户端(plan.md 1.6 落库通道)
// 配置默认读仓库根 .mcp.json,可被 JOBSYNC_MCP_URL / JOBSYNC_MCP_TOKEN 覆盖

interface McpConfig {
  url: string;
  token: string;
}

function loadMcpConfig(): McpConfig {
  const url = process.env.JOBSYNC_MCP_URL;
  const token = process.env.JOBSYNC_MCP_TOKEN;
  if (url && token) return { url, token };
  const raw = JSON.parse(readFileSync(resolve('.mcp.json'), 'utf8')) as {
    mcpServers: { jobsync: { url: string; headers: { Authorization: string } } };
  };
  const server = raw.mcpServers.jobsync;
  return {
    url: url ?? server.url,
    token: token ?? server.headers.Authorization.replace(/^Bearer\s+/, ''),
  };
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const config = loadMcpConfig();
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  if (!response.ok) {
    throw new Error(`jobsync MCP HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    error?: { message?: string };
    result?: { content?: Array<{ type: string; text?: string }> };
  };
  if (body.error) {
    throw new Error(body.error.message ?? 'jobsync MCP 调用失败');
  }
  return (
    body.result?.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n') ?? ''
  );
}

export interface AddJobResult {
  created: boolean;
  jobId?: string;
  message: string;
}

// add_job 以文本回报告知结果(创建/重复/错误),这里把文本解析回结构
export function parseAddJobResult(text: string): AddJobResult {
  if (/^(Error:|Rate limit exceeded)/.test(text)) {
    throw new Error(text.slice(0, 300));
  }
  const created = /Job created \(id: ([^)]+)\)/.exec(text);
  if (created) {
    return { created: true, jobId: created[1], message: text };
  }
  if (/^Duplicate detected/.test(text)) {
    return { created: false, message: text };
  }
  throw new Error(`无法解析 add_job 返回:${text.slice(0, 300)}`);
}

export async function addJob(input: AddJobInput): Promise<AddJobResult> {
  const text = await callMcpTool('add_job', { ...input });
  return parseAddJobResult(text);
}

export interface JobRow {
  id: string;
  jobTitle: string;
  company: string;
  city: string | null;
  salary: string | null;
  matchScore: number | null;
  weekendRestStatus: string;
  hrReplyAt?: string | null;
  greetingSentAt?: string | null;
  status: string;
}

export interface FullJob extends JobRow {
  source: string | null;
  jobUrl: string | null;
  jobDescription: string;
}

export function parseJobRows(text: string): JobRow[] {
  if (/^(Error:|Rate limit exceeded)/.test(text)) {
    throw new Error(text.slice(0, 300));
  }
  return JSON.parse(text) as JobRow[];
}

export function parseFullJob(text: string): FullJob {
  if (/^(Error:|Rate limit exceeded|Job not found)/.test(text)) {
    throw new Error(text.slice(0, 300));
  }
  return JSON.parse(text) as FullJob;
}

export async function listJobs(limit = 50): Promise<JobRow[]> {
  const text = await callMcpTool('list_jobs', { limit });
  return parseJobRows(text);
}

export async function listUnscoredJobs(limit = 50): Promise<JobRow[]> {
  const text = await callMcpTool('list_jobs', { limit, unscoredOnly: true });
  return parseJobRows(text);
}

export async function listJobsByStatus(
  status: string,
  limit = 50,
): Promise<JobRow[]> {
  const text = await callMcpTool('list_jobs', { status, limit });
  return parseJobRows(text);
}

export async function markGreetingSent(
  jobId: string,
  sentAt?: Date,
): Promise<void> {
  const text = await callMcpTool('mark_greeting_sent', {
    jobId,
    ...(sentAt ? { sentAt: sentAt.toISOString() } : {}),
  });
  if (/^(Error:|Rate limit exceeded|Job not found|Refused:)/.test(text)) {
    throw new Error(text.slice(0, 300));
  }
}

export async function getJob(jobId: string): Promise<FullJob> {
  const text = await callMcpTool('get_job', { jobId });
  return parseFullJob(text);
}

export async function updateEvaluation(
  jobId: string,
  score: number,
  evaluationReport: string,
  matchData: string,
): Promise<void> {
  const text = await callMcpTool('update_evaluation', {
    jobId,
    score,
    evaluationReport,
    matchData,
  });
  if (/^(Error:|Rate limit exceeded|matchData is not valid)/.test(text)) {
    throw new Error(text.slice(0, 300));
  }
}

export async function addHrReply(
  jobId: string,
  content: string,
  repliedAt?: Date,
): Promise<void> {
  const text = await callMcpTool('add_hr_reply', {
    jobId,
    content,
    ...(repliedAt ? { repliedAt: repliedAt.toISOString() } : {}),
  });
  if (/^(Error:|Rate limit exceeded|Job not found)/.test(text)) {
    throw new Error(text.slice(0, 300));
  }
}
