import { loadProfile } from '../lib/profile.js';
import { requiresGraduateDegree } from '../lib/filters.js';
import { addJob, type AddJobResult } from '../jobsync/mcp.js';
import {
  ZHAOPIN_CITY_CODES,
  closeZpTab,
  getZpJobDescription,
  openZpTab,
  searchZpJobs,
  type ZpCard,
} from './bridge.js';

// 智联招聘采集管道:画像「关键词 × 城市码」轮询 → 薪资下限过滤 → 详情页取 JD → add_job(URL 服务端去重)
// 用法:npm run zp:harvest [-- --limit 10] [-- --query X --city 天津]

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

function parseSalaryFloor(floor: string): number {
  const kMatch = /(\d+(?:\.\d+)?)\s*[kK千]/.exec(floor);
  if (kMatch) return Number(kMatch[1]) * 1000;
  const num = Number(floor.replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

// 智联薪资文本:"8000-12000元" / "1-1.5万" / "2-4万·13薪" / "200-250元/天" / "面议"
// 估算月薪上限,低于下限则跳过;"面议"不过滤
function salaryMaxMonthly(salary: string): number | null {
  if (!salary || salary.includes('面议')) return null;
  const range = /([\d.]+)\s*-\s*([\d.]+)\s*(万|千|元)/.exec(salary);
  if (!range) return null;
  const high = Number(range[2]);
  const unit = range[3];
  if (unit === '万') return high * 10000;
  if (unit === '千') return high * 1000;
  if (salary.includes('/天')) return high * 30;
  return high;
}

function cardCity(card: ZpCard): string {
  const location = card.infos[0] ?? '';
  return location.split('·')[0].trim() || '全国';
}

function buildSnapshot(card: ZpCard): string {
  return [
    `【${card.title}】(智联招聘快照,详情未取到)`,
    `公司:${card.company}`,
    `城市:${card.infos[0] ?? ''}`,
    `薪资:${card.salary}`,
    `要求:${card.infos.slice(1).join(' / ')}`,
    card.tags.length > 0 ? `标签:${card.tags.join(',')}` : '',
    `链接:${card.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function harvestCombo(
  tabId: string,
  query: string,
  city: string,
  limit: number,
  salaryFloor: number,
  totals: HarvestTotals,
): Promise<number> {
  const cityCode = city === '远程' ? null : (ZHAOPIN_CITY_CODES[city] ?? null);
  const cards = (await searchZpJobs(tabId, query, cityCode)).slice(0, limit);
  for (const card of cards) {
    if (requiresGraduateDegree(card.infos.join(' '))) {
      totals.degreeSkipped += 1;
      continue;
    }
    if (city === '远程') {
      const text = `${card.title} ${card.tags.join(' ')} ${card.infos.join(' ')}`;
      if (!text.includes('远程')) {
        totals.skipped += 1;
        continue;
      }
    }
    const maxMonthly = salaryMaxMonthly(card.salary);
    if (maxMonthly !== null && maxMonthly < salaryFloor) {
      totals.skipped += 1;
      continue;
    }
    const description = await getZpJobDescription(tabId, card.url);
    await new Promise((r) => setTimeout(r, DETAIL_INTERVAL_MS));
    try {
      const result: AddJobResult = await addJob({
        company: card.company,
        jobTitle: card.title,
        jobDescription: description ?? buildSnapshot(card),
        location: cardCity(card),
        source: '智联招聘',
        jobUrl: card.url,
        salaryRange: card.salary,
        tags: card.tags.slice(0, MAX_TAGS),
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
  return cards.length;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limitIndex = argv.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : 10;
  const queryIndex = argv.indexOf('--query');
  const cityIndex = argv.indexOf('--city');

  const profile = loadProfile();
  const salaryFloor = parseSalaryFloor(profile.salaryFloor);
  const combos =
    queryIndex >= 0 || cityIndex >= 0
      ? [{
          query: queryIndex >= 0 ? argv[queryIndex + 1] : profile.targetRoles[0],
          city: cityIndex >= 0 ? argv[cityIndex + 1] : profile.preferredCities[0],
        }]
      : // 应届友好:除原关键词外,每组城市追加「关键词 应届」组合
        [...profile.targetRoles, ...profile.targetRoles.map((q) => `${q} 应届`)].flatMap((query) =>
          profile.preferredCities.map((city) => ({ query, city })),
        );
  console.log(
    `智联按画像轮询:${combos.length} 组(含应届组合,薪资下限 ${salaryFloor / 1000}K)`,
  );

  const tabId = await openZpTab();
  const totals: HarvestTotals = { added: [], duplicates: 0, skipped: 0, degreeSkipped: 0, errors: [] };
  let emptyStreak = 0;
  try {
    for (let i = 0; i < combos.length; i += 1) {
      const { query, city } = combos[i];
      try {
        const found = await harvestCombo(tabId, query, city, limit, salaryFloor, totals);
        // 连续两组 0 卡片:大概率触发验证页,熔断本轮
        emptyStreak = found === 0 ? emptyStreak + 1 : 0;
        if (emptyStreak >= 2) {
          console.log('\n智联连续两组搜索 0 卡片,可能触发验证,本轮熔断');
          break;
        }
      } catch (error) {
        totals.errors.push({ title: `${query} @ ${city}`, message: (error as Error).message });
      }
      console.log(
        `[${query} @ ${city}] 累计:新入库 ${totals.added.length} · 重复 ${totals.duplicates} · 跳过 ${totals.skipped} · 学历跳过 ${totals.degreeSkipped} · 异常 ${totals.errors.length}`,
      );
      if (i < combos.length - 1) {
        await new Promise((r) => setTimeout(r, COMBO_INTERVAL_MS));
      }
    }
  } finally {
    await closeZpTab(tabId);
  }
  console.log(
    `\n智联收取完成:新入库 ${totals.added.length} · 重复 ${totals.duplicates} · 跳过 ${totals.skipped} · 学历跳过 ${totals.degreeSkipped} · 异常 ${totals.errors.length}`,
  );
}

main().catch((error: unknown) => {
  console.error(`智联收取失败:${(error as Error).message}`);
  process.exit(1);
});
