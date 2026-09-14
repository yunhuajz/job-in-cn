import { expect, it } from 'vitest';
import { calculateEmptyStreak, keepUnseen } from '../../src/crawler/sources.js';

it('列表阶段跳过已收录岗位，不为它进入详情采集', async () => {
  const cards = [{ url: 'known' }, { url: 'new' }];
  await expect(keepUnseen(cards, (card) => card.url, async (url) => url === 'known')).resolves.toEqual([{ url: 'new' }]);
});

it('所有岗位均已收录时，不累加 emptyStreak 也不会误报崩溃', () => {
  // 平台搜出 10 条，但由于都已收录 unseen=0
  const result = calculateEmptyStreak(1, 10, 0);
  expect(result.streak).toBe(0);
  expect(result.shouldError).toBe(false);
  expect(result.message).toContain('均已收录');
});

it('平台真正连续两组返回 0 结果时才触发空结果错误', () => {
  const first = calculateEmptyStreak(0, 0, 0);
  expect(first.streak).toBe(1);
  expect(first.shouldError).toBe(false);

  const second = calculateEmptyStreak(first.streak, 0, 0);
  expect(second.streak).toBe(2);
  expect(second.shouldError).toBe(true);
});
