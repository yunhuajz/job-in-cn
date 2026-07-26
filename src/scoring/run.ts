import { existsSync, readFileSync } from 'node:fs';
import { loadProfile } from '../lib/profile.js';
import {
  getJob,
  listJobs,
  updateEvaluation,
} from '../jobsync/mcp.js';
import { buildEvaluationReport, scoreJob } from './score.js';

// 无人值守评分入口(design.md §4):未评分职位 → LLM 五维评分 → update_evaluation
// 用法:npm run score [-- --limit 10]

// 主仓库不引 dotenv:读根目录 .env(若存在),不覆盖已有环境变量
function loadDotenv(): void {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function parseLimit(argv: string[]): number {
  const index = argv.indexOf('--limit');
  const value = index >= 0 ? Number(argv[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 20;
}

async function main(): Promise<void> {
  loadDotenv();
  const profile = loadProfile();
  const apiKey = process.env[profile.scoring.apiKeyEnv];
  if (!apiKey) {
    console.error(
      `缺少评分密钥:请在根目录 .env 配置 ${profile.scoring.apiKeyEnv}=<key>` +
        `(provider: ${profile.scoring.baseURL}, model: ${profile.scoring.model})`,
    );
    process.exit(1);
  }
  const clientConfig = {
    baseURL: profile.scoring.baseURL,
    apiKey,
    model: profile.scoring.model,
  };

  const limit = parseLimit(process.argv.slice(2));
  const unscored = (await listJobs(50)).filter((j) => j.matchScore === null);
  const batch = unscored.slice(0, limit);
  if (batch.length === 0) {
    console.log('没有未评分职位。');
    return;
  }
  console.log(`待评分 ${unscored.length} 个,本次评 ${batch.length} 个。`);

  let done = 0;
  let failed = 0;
  for (const row of batch) {
    try {
      const job = await getJob(row.id);
      const result = await scoreJob(profile, job, clientConfig);
      const report = buildEvaluationReport(result, job);
      const matchData = JSON.stringify({
        score: result.score,
        dimensions: result.dimensions,
        legality: result.legality,
        missingInfo: result.missingInfo,
        summary: result.summary,
        model: clientConfig.model,
      });
      await updateEvaluation(row.id, result.score, report, matchData);
      done += 1;
      console.log(
        `  ${result.score.toFixed(1)}  ${row.jobTitle} @ ${row.company} — ${result.summary}`,
      );
    } catch (error) {
      failed += 1;
      console.error(
        `  ! ${row.jobTitle} @ ${row.company}: ${(error as Error).message}`,
      );
    }
    // 克制节奏,避免触发 LLM 提供方限流
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`\n评分完成:成功 ${done} · 失败 ${failed}`);
}

main().catch((error: unknown) => {
  console.error(`评分失败:${(error as Error).message}`);
  process.exit(1);
});
