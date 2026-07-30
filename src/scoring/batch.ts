import { existsSync, readFileSync } from 'node:fs';
import { loadProfile, type CandidateProfile } from '../lib/profile.js';
import { getJob, listUnscoredJobs, updateEvaluation } from '../jobsync/mcp.js';
import { buildEvaluationReport, scoreJob } from './score.js';

// 批量评分主逻辑(CLI 与 daemon 共用,design.md §2/§4)

// 主仓库不引 dotenv:读根目录 .env(若存在),不覆盖已有环境变量
export function loadDotenv(): void {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

export interface ScoreBatchItem {
  jobTitle: string;
  company: string;
  score?: number;
  summary?: string;
  error?: string;
}

export interface ScoreBatchResult {
  pending: number;
  done: number;
  failed: number;
  items: ScoreBatchItem[];
}

export class MissingApiKeyError extends Error {
  constructor(apiKeyEnv: string, baseURL: string) {
    super(
      `缺少评分密钥:请在根目录 .env 配置 ${apiKeyEnv}=<key>(provider: ${baseURL})`,
    );
  }
}

export async function scoreUnscoredJobs(
  limit: number,
  onItem?: (item: ScoreBatchItem) => void,
): Promise<ScoreBatchResult> {
  loadDotenv();
  const profile: CandidateProfile = loadProfile();
  const apiKey = process.env[profile.scoring.apiKeyEnv];
  if (!apiKey) {
    throw new MissingApiKeyError(
      profile.scoring.apiKeyEnv,
      profile.scoring.baseURL,
    );
  }
  const clientConfig = {
    baseURL: profile.scoring.baseURL,
    apiKey,
    model: profile.scoring.model,
  };

  const unscored = await listUnscoredJobs(50);
  const batch = unscored.slice(0, limit);
  const result: ScoreBatchResult = {
    pending: unscored.length,
    done: 0,
    failed: 0,
    items: [],
  };
  for (const row of batch) {
    const item: ScoreBatchItem = {
      jobTitle: row.jobTitle,
      company: row.company,
    };
    try {
      const job = await getJob(row.id);
      const scored = await scoreJob(profile, job, clientConfig);
      const report = buildEvaluationReport(scored, job);
      const matchData = JSON.stringify({
        score: scored.score,
        dimensions: scored.dimensions,
        legality: scored.legality,
        missingInfo: scored.missingInfo,
        summary: scored.summary,
        model: clientConfig.model,
      });
      await updateEvaluation(row.id, scored.score, report, matchData);
      result.done += 1;
      item.score = scored.score;
      item.summary = scored.summary;
    } catch (error) {
      result.failed += 1;
      item.error = (error as Error).message;
    }
    result.items.push(item);
    onItem?.(item);
    // 克制节奏,避免触发 LLM 提供方限流
    await new Promise((r) => setTimeout(r, 1000));
  }
  return result;
}
