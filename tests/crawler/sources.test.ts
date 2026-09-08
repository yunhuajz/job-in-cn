import { expect, it } from 'vitest';
import { keepUnseen } from '../../src/crawler/sources.js';

it('列表阶段跳过已收录岗位，不为它进入详情采集', async () => {
  const cards = [{ url: 'known' }, { url: 'new' }];
  await expect(keepUnseen(cards, (card) => card.url, async (url) => url === 'known')).resolves.toEqual([{ url: 'new' }]);
});
