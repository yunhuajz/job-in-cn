import { setTimeout as delay } from 'node:timers/promises';
import { bossDetail, bossSearch, bossWhoami } from '../boss/bridge.js';
import { toAddJobInput, type AddJobInput } from '../boss/map.js';
import { get51JobDescription, search51Jobs } from '../job51/bridge.js';
import { closeZpTab, getZpJobDescription, openZpTab, resolveZhaopinCityCode, searchZpJobs, ZHAOPIN_CITY_CODES } from '../zhaopin/bridge.js';
import type { CrawlerConfig, ExperienceOption } from './config.js';
import type { GroupSource } from './plan-run.js';

export function toBossExperience(option?: ExperienceOption): string | undefined {
  switch (option) {
    case 'fresh': return '应届生(校招)';
    case '1year': return '1年以内';
    case '1-3': return '1-3年';
    case '3-5': return '3-5年';
    case '5-10': return '5-10年';
    default: return undefined;
  }
}

export function to51JobExperience(option?: ExperienceOption): string | undefined {
  switch (option) {
    case 'fresh': return '应届';
    case '1year': return '1年以内';
    case '1-3': return '1-3年';
    case '3-5': return '3-5年';
    case '5-10': return '5-7年';
    default: return undefined;
  }
}

export function toZhaopinExperience(option?: ExperienceOption): string | undefined {
  switch (option) {
    case 'fresh': return '0001';
    case '1year': return '0101';
    case '1-3': return '0103';
    case '3-5': return '0305';
    case '5-10': return '0510';
    default: return undefined;
  }
}

export type KnownUrl = (url: string) => Promise<boolean>;

export async function keepUnseen<T>(items: T[], getUrl: (item: T) => string, isKnown?: KnownUrl): Promise<T[]> {
  if (!isKnown) return items;
  const unseen: T[] = [];
  for (const item of items) if (!await isKnown(getUrl(item))) unseen.push(item);
  return unseen;
}

export function calculateEmptyStreak(prevStreak: number, rawCount: number, unseenCount: number): {
  streak: number;
  shouldError: boolean;
  message?: string;
} {
  if (rawCount === 0) {
    const nextStreak = prevStreak + 1;
    return {
      streak: nextStreak,
      shouldError: nextStreak >= 2,
      message: nextStreak >= 2 ? '连续两组没有岗位，请检查搜索条件或浏览器验证页面后重试' : undefined,
    };
  }
  return {
    streak: 0,
    shouldError: false,
    message: unseenCount === 0 ? `本组检索到 ${rawCount} 个岗位均已收录，暂无新岗位发布。` : undefined,
  };
}

// 复用已验证的平台适配器；浏览器是外部边界，停止时不再开始下一条操作。
export async function* collectJobs(config: CrawlerConfig, signal: AbortSignal, log: (text: string) => void, page = 1, isKnown?: KnownUrl): AsyncIterable<AddJobInput> {
  let tab: string | undefined;
  let emptyStreak = 0;
  try {
    if (config.platform === 'boss' && !(await bossWhoami()).loggedIn) throw new Error('请先在 Chrome 登录 Boss 直聘，再开始采集');
    if (signal.aborted) return;
    if (config.platform === 'zhaopin') tab = await openZpTab();
    const combos = [...new Set(config.keywords)].flatMap((query) => [...new Set(config.cities)].map((city) => ({ query, city })));
    for (let index = 0; index < combos.length; index += 1) {
      if (signal.aborted) return;
      const { query, city } = combos[index];
      log(`搜索 ${index + 1}/${combos.length}：${query} · ${city}`);
      let jobs: Array<() => Promise<AddJobInput>>;
      let rawCount = 0;
      if (config.platform === 'boss') {
        const raw = await bossSearch({
          query,
          city: city === '全国' || city === '远程' ? undefined : city,
          experience: toBossExperience(config.experience),
          limit: config.limit,
          page,
        });
        rawCount = raw.length;
        const cards = await keepUnseen(raw, (card) => card.url, isKnown);
        jobs = cards.slice(0, config.limit).map((card) => async () => {
          const detail = await bossDetail(card.securityId);
          const input = toAddJobInput(card, detail);
          input.location = [detail.city, detail.district, detail.address].filter(Boolean).join(' ');
          input.jobDescription += `\n福利：${detail.welfare}`;
          return input;
        });
      } else if (config.platform === 'job51') {
        const raw = await search51Jobs(
          query,
          city === '远程' ? '全国' : city,
          config.limit,
          page,
          to51JobExperience(config.experience),
        );
        rawCount = raw.length;
        const cards = await keepUnseen(raw, (card) => card.url, isKnown);
        jobs = cards.slice(0, config.limit).map((card) => async () => ({
          company: card.companyFull ?? card.company, jobTitle: card.title,
          jobDescription: `${await get51JobDescription(card.jobId) ?? '详情未获取，仅保留搜索页信息。'}\n${card.tags ?? ''}\n${card.degree ?? ''} ${card.workYear ?? ''}`,
          location: [card.city, card.district].filter(Boolean).join(' '), source: '前程无忧51job',
          jobUrl: card.url, salaryRange: card.salary, tags: (card.tags ?? '').split(',').filter(Boolean).slice(0, 5),
          experience: card.workYear,
        }));
      } else {
        const code = resolveZhaopinCityCode(city);
        if (!code && city !== '全国' && city !== '远程') log(`智联暂未配置“${city}”城市码，将全国搜索后按地点筛选。`);
        const raw = await searchZpJobs(tab!, query, code, {
          page,
          experience: toZhaopinExperience(config.experience),
        });
        const matched = raw.filter((card) => code || city === '全国' || city === '远程' || card.infos[0]?.includes(city));
        rawCount = matched.length;
        const unseen = await keepUnseen(matched, (card) => card.url, isKnown);
        jobs = unseen.slice(0, config.limit).map((card) => async () => ({
          company: card.company, jobTitle: card.title,
          jobDescription: `${card.description || await getZpJobDescription(tab!, card.url) || '详情未获取，仅保留搜索页信息。'}\n${card.tags.join(' ')}\n${card.infos.join(' ')}`,
          location: card.infos[0] ?? '', source: '智联招聘', jobUrl: card.url, salaryRange: card.salary, tags: card.tags.slice(0, 5),
          experience: card.infos.find((info) => /经验|应届|年/.test(info)) ?? '',
        }));
      }
      log(`本组返回 ${jobs.length} 个新岗位`);
      const check = calculateEmptyStreak(emptyStreak, rawCount, jobs.length);
      emptyStreak = check.streak;
      if (check.message) log(check.message);
      if (check.shouldError) throw new Error(check.message ?? '连续两组没有岗位，请检查搜索条件或浏览器验证页面后重试');
      for (const getJob of jobs) {
        if (signal.aborted) return;
        const job = await getJob();
        if (signal.aborted) return;
        if (city !== '远程' || /远程/.test(`${job.jobTitle} ${job.jobDescription} ${job.location}`)) yield job;
        else log(`非远程岗位跳过：${job.jobTitle}`);
        await delay(20_000, undefined, { signal });
      }
      if (index < combos.length - 1) {
        log('本组结束，等待 5 分钟后搜索下一组');
        await delay(300_000, undefined, { signal });
      }
    }
  } finally {
    if (tab) await closeZpTab(tab);
  }
}

export function roundToCyclePage(round: number, cycleSize = 10): number {
  if (round <= 0) return 1;
  return ((round - 1) % cycleSize) + 1;
}

export async function* collectSearchGroup(config: CrawlerConfig, group: Parameters<GroupSource>[1], signal: AbortSignal, log: (text: string) => void, isKnown?: KnownUrl): AsyncIterable<AddJobInput> {
  const page = roundToCyclePage(group.round);
  yield* collectJobs({ ...config, keywords: [group.query], cities: [group.city] }, signal, log, page, isKnown);
}
