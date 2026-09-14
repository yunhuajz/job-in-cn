import { expect, it } from 'vitest';
import { bossSearch } from '../../src/boss/bridge.js';

it('Boss 搜索将潍坊转换为城市码，避免未知城市回退北京', async () => {
  let received: string[] = [];
  await bossSearch({ query: 'AI', city: '潍坊' }, async (args) => {
    received = args;
    return [];
  });

  expect(received).toContain('101120600');
  expect(received).not.toContain('潍坊');
});
