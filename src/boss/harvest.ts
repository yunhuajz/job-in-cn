import { existsSync } from 'node:fs';
import { loadProfile, DEFAULT_PROFILE_PATH } from '../lib/profile.js';
import { bossWhoami } from './bridge.js';
import { harvestJobs, type HarvestReport } from './pipeline.js';

// 一键收取(plan.md 1.7):画像「关键词 × 城市」轮询,或用 CLI 参数指定单组
// 用法:
//   npm run boss:harvest                          # 按画像轮询
//   npm run boss:harvest -- --query "AI Agent" --city 北京 --limit 10

interface CliArgs {
  query?: string;
  city?: string;
  experience?: string;
  limit?: number;
}

function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--query' && value) args.query = value;
    if (flag === '--city' && value) args.city = value;
    if (flag === '--experience' && value) args.experience = value;
    if (flag === '--limit' && value) args.limit = Number(value);
  }
  return args;
}

function printReport(label: string, report: HarvestReport): void {
  console.log(
    `\n[${label}] 新入库 ${report.added.length} · 重复跳过 ${report.duplicates.length} · 异常 ${report.errors.length}`,
  );
  for (const item of report.added) {
    console.log(`  + ${item.title} (${item.jobSyncId})`);
  }
  for (const item of report.errors) {
    console.log(`  ! ${item.title}: ${item.message}`);
  }
}

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));

  const whoami = await bossWhoami();
  if (!whoami.loggedIn) {
    console.error('Boss 未登录:请先在日常 Chrome 里登录 www.zhipin.com 再重跑。');
    process.exit(1);
  }

  let combos: Array<{ query?: string; city?: string; experience?: string }>;
  if (cli.query || cli.city) {
    combos = [
      { query: cli.query, city: cli.city, experience: cli.experience },
    ];
  } else if (existsSync(DEFAULT_PROFILE_PATH)) {
    const profile = loadProfile();
    combos = profile.targetRoles.flatMap((query) =>
      profile.preferredCities.map((city) => ({
        query,
        city,
        experience: profile.experience,
      })),
    );
    console.log(
      `按画像轮询:${profile.targetRoles.length} 个关键词 × ${profile.preferredCities.length} 个城市 = ${combos.length} 组`,
    );
  } else {
    // 无画像无参数:收一轮「为你推荐」
    combos = [{}];
    console.log('未找到画像也未指定参数,收取「为你推荐」一页。');
  }

  const limit = cli.limit ?? 15;
  const totals = { added: 0, duplicates: 0, errors: 0 };
  for (const combo of combos) {
    const label = `${combo.query ?? '为你推荐'} @ ${combo.city ?? '默认城市'}`;
    const report = await harvestJobs({ ...combo, limit });
    printReport(label, report);
    totals.added += report.added.length;
    totals.duplicates += report.duplicates.length;
    totals.errors += report.errors.length;
    if (report.abortedByRateLimit) {
      console.log(
        '\njobsync MCP 限流,整批熔断:等限流窗口重置(≤1 小时)后再跑,剩余组合未执行。',
      );
      break;
    }
  }
  console.log(
    `\n收取完成:新入库 ${totals.added} · 重复 ${totals.duplicates} · 异常 ${totals.errors}`,
  );
}

main().catch((error: unknown) => {
  console.error(`收取失败:${(error as Error).message}`);
  process.exit(1);
});
