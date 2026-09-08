import { expect, it } from 'vitest';
import { CrawlRun } from '../../src/crawler/run.js';
import { crawlerConfigSchema } from '../../src/crawler/config.js';

it('采集使用保存条件，统计新增与重复，重复启动被拒绝，停止后不再入库', async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const saved: string[] = [];
  const config = crawlerConfigSchema.parse({ keywords: ['AI'], cities: ['天津'], salaryMin: 8000 });
  const run = new CrawlRun(async function* (received) {
    expect(received).toEqual(config);
    for (const title of ['低薪', '新增', '重复']) {
      yield { company: '公司', jobTitle: title, salaryRange: title === '低薪' ? '5-6K' : '8-12K', location: '天津', jobDescription: '双休', source: 'Boss直聘', jobUrl: `https://example.test/${title}`, tags: [] };
    }
    await wait;
    yield { company: '公司', jobTitle: '停止后', salaryRange: '8-12K', location: '天津', jobDescription: '', source: 'Boss直聘', jobUrl: 'https://example.test/after', tags: [] };
  });
  const save = async (job: { jobTitle: string }) => {
    saved.push(job.jobTitle);
    return { created: job.jobTitle !== '重复' };
  };
  run.start(config, save);
  expect(() => run.start(config, save)).toThrow('正在采集');
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(run.snapshot()).toMatchObject({ status: 'running', added: 1, duplicates: 1, skipped: 1 });
  run.stop();
  expect(run.snapshot().status).toBe('stopping');
  release();
  await run.finished();
  expect(saved).toEqual(['新增', '重复']);
  expect(run.snapshot().status).toBe('stopped');
});
