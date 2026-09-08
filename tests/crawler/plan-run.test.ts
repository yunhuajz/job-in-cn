import { expect, it } from 'vitest';
import { crawlerConfigSchema, crawlerPlanSchema } from '../../src/crawler/config.js';
import { CrawlPlanRun } from '../../src/crawler/plan-run.js';

it('采集轮次在每个搜索组后轮转平台，并按设置重复', async () => {
  const seen: string[] = [];
  const run = new CrawlPlanRun(async function* (config, group) {
    seen.push(`${group.round}:${config.platform}:${group.query}:${group.city}`);
    yield { company: '公司', jobTitle: group.query, jobDescription: '双休', location: group.city, source: config.platform, jobUrl: `https://example.test/${seen.length}`, salaryRange: '10-15K', tags: [] };
  });
  const configs = [
    crawlerConfigSchema.parse({ platform: 'boss', keywords: ['AI', '数据'], cities: ['天津'] }),
    crawlerConfigSchema.parse({ platform: 'job51', keywords: ['AI', '数据'], cities: ['天津'] }),
  ];
  run.start(crawlerPlanSchema.parse({ platforms: ['boss', 'job51'], rounds: 2 }), configs, async () => ({ created: true }));
  await run.finished();
  expect(seen).toEqual([
    '1:boss:AI:天津', '1:job51:AI:天津', '1:boss:数据:天津', '1:job51:数据:天津',
    '2:boss:AI:天津', '2:job51:AI:天津', '2:boss:数据:天津', '2:job51:数据:天津',
  ]);
  expect(run.snapshot()).toMatchObject({ status: 'completed', added: 8, round: 2 });
});

it('暂停后不开始下一条，手动恢复后继续当前采集轮次', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const run = new CrawlPlanRun(async function* () {
    yield { company: '公司', jobTitle: '第一条', jobDescription: '', location: '天津', source: 'boss', jobUrl: 'https://example.test/first', salaryRange: '10-15K', tags: [] };
    await gate;
    yield { company: '公司', jobTitle: '第二条', jobDescription: '', location: '天津', source: 'boss', jobUrl: 'https://example.test/second', salaryRange: '10-15K', tags: [] };
  });
  const config = crawlerConfigSchema.parse({ platform: 'boss', keywords: ['AI'], cities: ['天津'] });
  run.start(crawlerPlanSchema.parse({ platforms: ['boss'], rounds: 1 }), [config], async () => ({ created: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  run.pauseFor(1);
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(run.snapshot()).toMatchObject({ status: 'paused', visited: 1 });
  run.resume();
  await run.finished();
  expect(run.snapshot()).toMatchObject({ status: 'completed', visited: 2, added: 2 });
});

it('一个平台遇验证时只暂停该平台，其他平台继续本轮采集', async () => {
  const run = new CrawlPlanRun(async function* (config) {
    if (config.platform === 'boss') throw new Error('请完成滑块验证');
    yield { company: '公司', jobTitle: '可继续采集', jobDescription: '', location: '天津', source: 'job51', jobUrl: 'https://example.test/job51', salaryRange: '10-15K', tags: [] };
  });
  const configs = [
    crawlerConfigSchema.parse({ platform: 'boss', keywords: ['AI'], cities: ['天津'] }),
    crawlerConfigSchema.parse({ platform: 'job51', keywords: ['AI'], cities: ['天津'] }),
  ];
  run.start(crawlerPlanSchema.parse({ platforms: ['boss', 'job51'], rounds: 1 }), configs, async () => ({ created: true }));
  await run.finished();
  expect(run.snapshot()).toMatchObject({ status: 'completed', added: 1, blockedPlatforms: { boss: '请完成滑块验证' } });
});

it('采集在下一个搜索组前执行平台间隔', async () => {
  let waits = 0;
  const run = new CrawlPlanRun(async function* (config) {
    yield { company: '公司', jobTitle: config.platform, jobDescription: '', location: '天津', source: config.platform, jobUrl: `https://example.test/${config.platform}`, salaryRange: '10-15K', tags: [] };
  }, async () => { waits += 1; });
  const configs = ['boss', 'job51'].map((platform) => crawlerConfigSchema.parse({ platform, keywords: ['AI'], cities: ['天津'] }));
  run.start(crawlerPlanSchema.parse({ platforms: ['boss', 'job51'], rounds: 1 }), configs, async () => ({ created: true }));
  await run.finished();
  expect(waits).toBe(1);
});

it('从保存的搜索组位置恢复采集，不重复已完成的组', async () => {
  const seen: string[] = [];
  const run = new CrawlPlanRun(async function* (_config, group) {
    seen.push(group.query);
    yield { company: '公司', jobTitle: group.query, jobDescription: '', location: '天津', source: 'boss', jobUrl: `https://example.test/${group.query}`, salaryRange: '10-15K', tags: [] };
  });
  const config = crawlerConfigSchema.parse({ platform: 'boss', keywords: ['第一组', '第二组'], cities: ['天津'] });
  run.start(crawlerPlanSchema.parse({ platforms: ['boss'], rounds: 1 }), [config], async () => ({ created: true }), { round: 1, index: 1 });
  await run.finished();
  expect(seen).toEqual(['第二组']);
});
