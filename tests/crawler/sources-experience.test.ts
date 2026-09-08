import { expect, it } from 'vitest';
import { toBossExperience, to51JobExperience } from '../../src/crawler/sources.js';
import { search51Jobs } from '../../src/job51/bridge.js';

it('Boss 与 51job 经验映射转换正确', () => {
  expect(toBossExperience('fresh')).toBe('应届生(校招)');
  expect(toBossExperience('1year')).toBe('1年以内');
  expect(toBossExperience('1-3')).toBe('1-3年');
  expect(toBossExperience('3-5')).toBe('3-5年');
  expect(toBossExperience('5-10')).toBe('5-10年');
  expect(toBossExperience('fresh_or_1year')).toBeUndefined();
  expect(toBossExperience('any')).toBeUndefined();

  expect(to51JobExperience('fresh')).toBe('应届');
  expect(to51JobExperience('1year')).toBe('1年以内');
  expect(to51JobExperience('1-3')).toBe('1-3年');
  expect(to51JobExperience('3-5')).toBe('3-5年');
  expect(to51JobExperience('5-10')).toBe('5-7年');
  expect(to51JobExperience('fresh_or_1year')).toBeUndefined();
  expect(to51JobExperience('any')).toBeUndefined();
});

it('search51Jobs 支持传入经验参数并附加 --experience 命令行参数', async () => {
  const calls: string[][] = [];
  await search51Jobs('前端', '北京', 10, 1, '1-3年', async (args) => {
    calls.push(args);
    return [];
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('--experience');
  expect(calls[0]).toContain('1-3年');
});
