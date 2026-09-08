import { expect, it } from 'vitest';
import { search51Jobs } from '../../src/job51/bridge.js';

it('前程无忧后续轮次使用下一页搜索结果', async () => {
  const calls: string[][] = [];
  await search51Jobs('AI', '天津', 10, 2, async (args) => { calls.push(args); return []; });
  expect(calls[0]).toContain('--page');
  expect(calls[0]).toContain('2');
});
