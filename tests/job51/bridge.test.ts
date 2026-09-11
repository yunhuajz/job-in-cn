import { expect, it } from 'vitest';
import { get51JobDescription, search51Jobs } from '../../src/job51/bridge.js';

it('前程无忧后续轮次使用下一页搜索结果', async () => {
  const calls: string[][] = [];
  await search51Jobs('AI', '天津', 10, 2, async (args) => { calls.push(args); return []; });
  expect(calls[0]).toContain('--page');
  expect(calls[0]).toContain('2');
});

it('前程无忧详情页标识失效时重建页面并重试', async () => {
  const calls: string[][] = [];
  let detailCalls = 0;
  const description = await get51JobDescription('job-1', async (args) => {
    calls.push(args);
    if (args[0] === 'browser') return {};
    detailCalls += 1;
    if (detailCalls === 1) throw new Error('Page not found: OLD — stale page identity');
    return [{ description: '重试后取得的岗位详情' }];
  });

  expect(description).toBe('重试后取得的岗位详情');
  expect(calls.some((args) => args.slice(0, 4).join(' ') === 'browser default tab new')).toBe(true);
  expect(detailCalls).toBe(2);
});

it('前程无忧详情页重试后仍失效时返回空详情供采集继续', async () => {
  const description = await get51JobDescription('job-1', async (args) => {
    if (args[0] === 'browser') return {};
    throw new Error('Page not found: OLD — stale page identity');
  });

  expect(description).toBeNull();
});
