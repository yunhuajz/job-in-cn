import { getJob, listJobs, listJobsByStatus, markGreetingSent } from '../jobsync/mcp.js';
import {
  APPROVED_STATUS_LABEL,
  DAILY_GREET_LIMIT,
  createOpencliGreetIO,
  isWithinSendWindow,
  runGreetingBatch,
  type GreetCandidate,
} from './greet.js';

// P3 写侧入口(plan.md §3):npm run boss:greet
// 默认 dry-run 打印「已批准」候选清单(复述清单);--send=<id,id,...> 才真发。
// 铁律:只投已批准职位;≤20 条/天;仅 9:00–21:00;验证码/风控熔断停投。

function isTodayLocal(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

async function collectCandidates(): Promise<{
  candidates: GreetCandidate[];
  noUrl: string[];
  sentToday: number;
}> {
  // list_jobs 服务端硬上限 50(mcp.schema.ts)
  const approved = await listJobsByStatus(APPROVED_STATUS_LABEL, 50);
  const pending = approved.filter((row) => !row.greetingSentAt);

  const all = await listJobs(50);
  const sentToday = all.filter(
    (row) => row.greetingSentAt && isTodayLocal(row.greetingSentAt),
  ).length;

  const quota = Math.max(0, DAILY_GREET_LIMIT - sentToday);
  const candidates: GreetCandidate[] = [];
  const noUrl: string[] = [];
  for (const row of pending.slice(0, quota)) {
    const full = await getJob(row.id);
    if (!full.jobUrl) {
      noUrl.push(`${full.company} / ${full.jobTitle}`);
      continue;
    }
    candidates.push({
      id: full.id,
      jobTitle: full.jobTitle,
      company: full.company,
      jobUrl: full.jobUrl,
    });
  }
  return { candidates, noUrl, sentToday };
}

async function main(): Promise<void> {
  const sendArg = process.argv.find((a) => a.startsWith('--send='));
  const sendIds = sendArg
    ? sendArg
        .slice('--send='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const { candidates, noUrl, sentToday } = await collectCandidates();

  console.log(
    `已批准待投 ${candidates.length} 个 · 今日已发 ${sentToday}/${DAILY_GREET_LIMIT}`,
  );
  for (const c of candidates) {
    console.log(`  - ${c.id}  ${c.company} / ${c.jobTitle}`);
    console.log(`    ${c.jobUrl}`);
  }
  for (const item of noUrl) {
    console.log(`  ! 缺 URL 跳过:${item}`);
  }

  if (sendIds.length === 0) {
    console.log('\ndry-run:未发送任何招呼。确认清单后用 --send=<id,id,...> 真发。');
    return;
  }

  const idSet = new Set(candidates.map((c) => c.id));
  const unknown = sendIds.filter((id) => !idSet.has(id));
  if (unknown.length > 0) {
    throw new Error(`--send 含未批准/不在候选清单的 id(A2 闸):${unknown.join(', ')}`);
  }
  if (!isWithinSendWindow(new Date())) {
    throw new Error('当前不在 9:00–21:00 发送窗口内,已拒绝执行。');
  }

  const targets = candidates.filter((c) => sendIds.includes(c.id));
  console.log(`\n开始发送 ${targets.length} 条(间隔 30s–3min,风控即熔断)…`);
  const io = createOpencliGreetIO((jobId) => markGreetingSent(jobId));
  const report = await runGreetingBatch(targets, io);

  console.log(`\n完成:发送 ${report.sent} · 结束原因 ${report.stoppedBy}`);
  for (const r of report.results) {
    console.log(
      `  - ${r.candidate.company} / ${r.candidate.jobTitle}: ${r.outcome}` +
        (r.detail ? ` (${r.detail})` : ''),
    );
  }
}

main().catch((error: unknown) => {
  console.error(`投递失败:${(error as Error).message}`);
  process.exit(1);
});
