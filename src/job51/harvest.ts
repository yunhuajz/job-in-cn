import { loadProfile } from '../lib/profile.js';
import { requiresGraduateDegree } from '../lib/filters.js';
import { addJob, type AddJobResult } from '../jobsync/mcp.js';
import { get51JobDescription, search51Jobs, type Job51Card } from './bridge.js';

// 51job 采集管道:画像「关键词 × 城市」轮询 → 薪资下限过滤 → 逐条详情 → add_job(URL 服务端去重)
// Boss 风控期间的主力采集源(51job 搜索无需登录,风控压力远小于 Boss)
// 用法:npm run job51:harvest [-- --limit 10]

const DETAIL_INTERVAL_MS = 8000;
const COMBO_INTERVAL_MS = 45_000;
const MAX_TAGS = 5;

interface HarvestTotals {
  added: string[];
  duplicates: number;
  skipped: number;
  degreeSkipped: number;
  errors: Array<{ title: string; message: string }>;
}

// salaryFloor 形如 "7K"/"7000",解析为数字下限;卡片 salaryMax 低于下限则跳过(不取详情)
function parseSalaryFloor(floor: string): number {
  const kMatch = /(\d+(?:\.\d+)?)\s*[kK千]/.exec(floor);
  if (kMatch) return Number(kMatch[1]) * 1000;
  const num = Number(floor.replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function buildSnapshot(card: Job51Card): string {
  return [
    `【${card.title}】(51job 快照,详情未取到)`,
    `公司:${card.companyFull ?? card.company}`,
    `城市:${card.city}${card.district ? `-${card.district}` : ''}`,
    `薪资:${card.salary}`,
    `要求:${card.workYear ?? ''} / ${card.degree ?? ''}`,
    card.tags ? `标签:${card.tags}` : '',
    `链接:${card.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function harvestCombo(
  query: string,
  area: string,
  limit: number,
  salaryFloor: number,
  totals: HarvestTotals,
): Promise<void> {
  const cards = await search51Jobs(query, area, limit);
  for (const card of cards) {
    if (requiresGraduateDegree(card.degree)) {
      totals.degreeSkipped += 1;
      continue;
    }
    if (card.salaryMax !== undefined && card.salaryMax < salaryFloor) {
      totals.skipped += 1;
      continue;
    }
    let description: string | null = null;
    try {
      description = await get51JobDescription(card.jobId);
    } catch {
      description = null;
    }
    await new Promise((r) => setTimeout(r, DETAIL_INTERVAL_MS));
    try {
      const result: AddJobResult = await addJob({
        company: card.companyFull ?? card.company,
        jobTitle: card.title,
        jobDescription: description ?? buildSnapshot(card),
        location: card.city,
        source: '前程无忧51job',
        jobUrl: card.url,
        salaryRange: card.salary,
        tags: (card.tags ?? '').split(',').filter(Boolean).slice(0, MAX_TAGS),
      });
      if (result.created) {
        totals.added.push(card.title);
      } else {
        totals.duplicates += 1;
      }
    } catch (error) {
      totals.errors.push({ title: card.title, message: (error as Error).message });
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limitIndex = argv.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : 10;
  const queryIndex = argv.indexOf('--query');
  const cityIndex = argv.indexOf('--city');
  const cliQuery = queryIndex >= 0 ? argv[queryIndex + 1] : undefined;
  const cliCity = cityIndex >= 0 ? argv[cityIndex + 1] : undefined;

  const profile = loadProfile();
  const salaryFloor = parseSalaryFloor(profile.salaryFloor);
  // 51job 无"远程"地区概念,映射为"全国"搜索,城市字段原样落库
  const cities = profile.preferredCities.map((c) => (c === '远程' ? '全国' : c));
  const combos =
    cliQuery || cliCity
      ? [{ query: cliQuery ?? profile.targetRoles[0], city: cliCity ?? cities[0] }]
      : // 应届友好:除原关键词外,每组城市追加「关键词 应届」组合,扩大校招/初级岗位覆盖
        [...profile.targetRoles, ...profile.targetRoles.map((q) => `${q} 应届`)].flatMap((query) =>
          cities.map((city) => ({ query, city })),
        );
  console.log(
    `51job 按画像轮询:${combos.length} 组(含应届组合,薪资下限 ${salaryFloor / 1000}K)`,
  );

  const totals: HarvestTotals = { added: [], duplicates: 0, skipped: 0, degreeSkipped: 0, errors: [] };
  for (let i = 0; i < combos.length; i += 1) {
    const { query, city } = combos[i];
    try {
      await harvestCombo(query, city, limit, salaryFloor, totals);
    } catch (error) {
      totals.errors.push({ title: `${query} @ ${city}`, message: (error as Error).message });
    }
    console.log(
      `[${query} @ ${city}] 累计:新入库 ${totals.added.length} · 重复 ${totals.duplicates} · 薪资跳过 ${totals.skipped} · 学历跳过 ${totals.degreeSkipped} · 异常 ${totals.errors.length}`,
    );
    if (i < combos.length - 1) {
      await new Promise((r) => setTimeout(r, COMBO_INTERVAL_MS));
    }
  }
  console.log(
    `\n51job 收取完成:新入库 ${totals.added.length} · 重复 ${totals.duplicates} · 薪资跳过 ${totals.skipped} · 学历跳过 ${totals.degreeSkipped} · 异常 ${totals.errors.length}`,
  );
}

main().catch((error: unknown) => {
  console.error(`51job 收取失败:${(error as Error).message}`);
  process.exit(1);
});
