import { existsSync, readFileSync } from 'node:fs';
import { updateEvaluation } from '../jobsync/mcp.js';
import { buildEvaluationReport, type ScoringResult } from './score.js';

// 写回会话内模型打分结果:读 data/scores.json → update_evaluation
// 用法:npm run score:apply

interface ScoreEntry {
  id: string;
  jobTitle: string;
  company: string;
  dimensions: ScoringResult['dimensions'];
  legality: ScoringResult['legality'];
  missingInfo: string[];
  summary: string;
  score: number;
}

async function main(): Promise<void> {
  if (!existsSync('data/scores.json')) {
    console.error('缺少 data/scores.json:先由会话内模型产出打分结果');
    process.exit(1);
  }
  const entries = JSON.parse(
    readFileSync('data/scores.json', 'utf8'),
  ) as ScoreEntry[];
  let done = 0;
  let failed = 0;
  for (const entry of entries) {
    const scored: ScoringResult = {
      dimensions: entry.dimensions,
      legality: entry.legality,
      missingInfo: entry.missingInfo,
      summary: entry.summary,
      score: entry.score,
    };
    try {
      const report = buildEvaluationReport(scored, {
        jobTitle: entry.jobTitle,
        company: entry.company,
        city: null,
        salary: null,
        jobDescription: '',
      });
      const matchData = JSON.stringify({
        score: entry.score,
        dimensions: entry.dimensions,
        legality: entry.legality,
        missingInfo: entry.missingInfo,
        summary: entry.summary,
        model: 'codex-in-session',
      });
      await updateEvaluation(entry.id, entry.score, report, matchData);
      done += 1;
      console.log(`  ${entry.score.toFixed(1)}  ${entry.jobTitle} @ ${entry.company}`);
    } catch (error) {
      failed += 1;
      console.error(
        `  ! ${entry.jobTitle} @ ${entry.company}: ${(error as Error).message}`,
      );
    }
  }
  console.log(`\n写回完成:成功 ${done} · 失败 ${failed}`);
}

main().catch((error: unknown) => {
  console.error(`写回失败:${(error as Error).message}`);
  process.exit(1);
});
