import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { CandidateProfile } from '../lib/profile.js';
import {
  chatCompletion,
  type ChatMessage,
  type FetchImpl,
  type ScoringClientConfig,
} from './client.js';

// 五维加权评分(design.md §4):LLM 出维度分,总分由系统按画像权重计算

const dimension = z.number().min(1).max(5);

const llmOutputSchema = z.object({
  dimensions: z.object({
    constraints: dimension,
    salary: dimension,
    company: dimension,
    skills: dimension,
    city: dimension,
  }),
  missingInfo: z.array(z.string()),
  legality: z.enum(['ok', 'suspect', 'illegal']),
  summary: z.string().min(1),
});

export type LlmScoringOutput = z.infer<typeof llmOutputSchema>;

export interface ScoringResult extends LlmScoringOutput {
  /** 系统按画像权重算出的总分(1.0–5.0,一位小数) */
  score: number;
}

export interface ScorableJob {
  jobTitle: string;
  company: string;
  city: string | null;
  salary: string | null;
  jobDescription: string;
}

// 容错解析:LLM 可能把 JSON 包在 markdown 围栏里或带前后废话
export function parseScoringOutput(text: string): LlmScoringOutput {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error(`评分输出中没有 JSON:${text.slice(0, 200)}`);
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  return llmOutputSchema.parse(parsed);
}

export function weightedScore(
  dimensions: LlmScoringOutput['dimensions'],
  weights: CandidateProfile['scoring']['weights'],
): number {
  const sum =
    dimensions.constraints * weights.constraints +
    dimensions.salary * weights.salary +
    dimensions.company * weights.company +
    dimensions.skills * weights.skills +
    dimensions.city * weights.city;
  return Math.min(5, Math.max(1, Math.round(sum * 10) / 10));
}

function loadSystemPrompt(): string {
  return readFileSync(resolve('src/prompts/scoring.md'), 'utf8');
}

export function buildScoringMessages(
  profile: CandidateProfile,
  job: ScorableJob,
): ChatMessage[] {
  const user = [
    '## 候选人画像',
    `目标岗位:${profile.targetRoles.join('、')}`,
    `期望城市:${profile.preferredCities.join('、')}`,
    `薪资下限:${profile.salaryFloor}`,
    `经验年限:${profile.experience}`,
    `技能清单:${profile.skills.join('、')}`,
    `公司惩罚词:${profile.avoidKeywords.join('、')}`,
    '',
    '## 职位信息',
    `职位:${job.jobTitle}`,
    `公司:${job.company}`,
    `城市:${job.city ?? '未知'}`,
    `薪资:${job.salary ?? '面议'}`,
    '',
    '## JD 全文',
    job.jobDescription,
  ].join('\n');
  return [
    { role: 'system', content: loadSystemPrompt() },
    { role: 'user', content: user },
  ];
}

export async function scoreJob(
  profile: CandidateProfile,
  job: ScorableJob,
  clientConfig: ScoringClientConfig,
  fetchImpl?: FetchImpl,
): Promise<ScoringResult> {
  const text = await chatCompletion(
    clientConfig,
    buildScoringMessages(profile, job),
    fetchImpl,
  );
  const output = parseScoringOutput(text);
  return {
    ...output,
    score: weightedScore(output.dimensions, profile.scoring.weights),
  };
}

// 评估报告 markdown → jobsync evaluationReport 列(ADR-0005)
export function buildEvaluationReport(
  result: ScoringResult,
  job: ScorableJob,
): string {
  const d = result.dimensions;
  const missing =
    result.missingInfo.length > 0 ? result.missingInfo.join('、') : '无';
  return [
    `## 评估报告:${job.jobTitle} @ ${job.company}`,
    '',
    `**总分 ${result.score} / 5.0**(${result.legality === 'ok' ? '合法' : `合法性:${result.legality}`})`,
    '',
    '| 维度 | 得分 |',
    '|---|---|',
    `| 硬性条件(双休/节假日) | ${d.constraints} |`,
    `| 薪资匹配 | ${d.salary} |`,
    `| 公司质量 | ${d.company} |`,
    `| 技能匹配 | ${d.skills} |`,
    `| 城市/通勤 | ${d.city} |`,
    '',
    `**摘要**:${result.summary}`,
    '',
    `**待确认信息**:${missing}`,
  ].join('\n');
}
