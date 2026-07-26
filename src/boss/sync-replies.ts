import { syncHrReplies } from './replies.js';

// HR 回复只读捕获入口(plan.md P3 读侧):npm run boss:sync-replies

async function main(): Promise<void> {
  const report = await syncHrReplies();
  console.log(
    `会话 ${report.conversations} 个 · 匹配库内职位 ${report.matched} · ` +
      `新捕获 ${report.captured} · 已记录跳过 ${report.alreadyRecorded} · 未匹配 ${report.unmatched.length}`,
  );
  for (const item of report.unmatched) {
    console.log(`  - 未匹配:${item.company} / ${item.jobTitle}`);
  }
  for (const item of report.errors) {
    console.log(`  ! ${item.company}: ${item.message}`);
  }
}

main().catch((error: unknown) => {
  console.error(`捕获失败:${(error as Error).message}`);
  process.exit(1);
});
