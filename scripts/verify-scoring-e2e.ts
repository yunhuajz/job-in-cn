import { createServer } from 'node:http';
import { loadProfile } from '../src/lib/profile.js';
import {
  getJob,
  listJobs,
  updateEvaluation,
} from '../src/jobsync/mcp.js';
import { buildEvaluationReport, scoreJob } from '../src/scoring/score.js';

// 一次性端到端验证(2026-07-26):mock OpenAI 服务器 + 真 jobsync MCP,
// 验证 评分→写回 链路;验证后由调用方复位数据。非仓库长期资产。

const MOCK_PORT = 18923;

const llmOutput = JSON.stringify({
  dimensions: { constraints: 3, salary: 4, company: 3.5, skills: 4.5, city: 4 },
  missingInfo: ['weekend_rest'],
  legality: 'ok',
  summary: '端到端验证用 mock 评分',
});

async function main(): Promise<void> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: llmOutput } }],
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(MOCK_PORT, '127.0.0.1', r));

  try {
    const profile = loadProfile();
    const mockConfig = {
      baseURL: `http://127.0.0.1:${MOCK_PORT}/v1`,
      apiKey: 'mock-key',
      model: 'mock-model',
    };
    const unscored = (await listJobs(50)).filter((j) => j.matchScore === null);
    if (unscored.length === 0) {
      console.log('NO_UNSCORED');
      return;
    }
    const target = unscored[0];
    const job = await getJob(target.id);
    const result = await scoreJob(profile, job, mockConfig);
    const report = buildEvaluationReport(result, job);
    const matchData = JSON.stringify({
      score: result.score,
      dimensions: result.dimensions,
      legality: result.legality,
      missingInfo: result.missingInfo,
      summary: result.summary,
      model: 'mock-model',
    });
    await updateEvaluation(target.id, result.score, report, matchData);
    console.log(
      `E2E_OK jobId=${target.id} score=${result.score} title=${target.jobTitle}`,
    );
  } finally {
    server.close();
  }
}

main().catch((error: unknown) => {
  console.error(`E2E_FAIL ${(error as Error).message}`);
  process.exit(1);
});
