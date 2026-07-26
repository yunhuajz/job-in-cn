import { MissingApiKeyError, scoreUnscoredJobs } from './batch.js';

// 无人值守评分入口(design.md §4):未评分职位 → LLM 五维评分 → update_evaluation
// 用法:npm run score [-- --limit 10]

function parseLimit(argv: string[]): number {
  const index = argv.indexOf('--limit');
  const value = index >= 0 ? Number(argv[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 20;
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  try {
    const result = await scoreUnscoredJobs(limit, (item) => {
      if (item.error) {
        console.error(`  ! ${item.jobTitle} @ ${item.company}: ${item.error}`);
      } else {
        console.log(
          `  ${item.score!.toFixed(1)}  ${item.jobTitle} @ ${item.company} — ${item.summary}`,
        );
      }
    });
    if (result.pending === 0) {
      console.log('没有未评分职位。');
      return;
    }
    console.log(`\n评分完成:成功 ${result.done} · 失败 ${result.failed}`);
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(`评分失败:${(error as Error).message}`);
  process.exit(1);
});
