import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toJobCard, toJobDetail } from '../../src/boss/map.js';
import { harvestJobs, type HarvestDeps } from '../../src/boss/pipeline.js';

const searchFixture = JSON.parse(
  readFileSync(resolve('tests/fixtures/boss/search.json'), 'utf8'),
) as unknown[];
const detailFixture = JSON.parse(
  readFileSync(resolve('tests/fixtures/boss/detail.json'), 'utf8'),
) as unknown[];

function makeDeps(overrides: Partial<HarvestDeps> = {}): HarvestDeps {
  return {
    search: async () => searchFixture.map(toJobCard),
    detail: async () => toJobDetail(detailFixture[0]),
    addJob: async () => ({ created: true, jobId: 'jobsync-1', message: 'ok' }),
    sleep: async () => {},
    ...overrides,
  };
}

describe('harvestJobs', () => {
  it('全部新增:逐条取详情并落库,报告 added', async () => {
    const added: string[] = [];
    const report = await harvestJobs(
      { query: 'AI Agent', city: '北京' },
      makeDeps({
        addJob: async (input) => {
          added.push(input.jobTitle);
          return { created: true, jobId: `id-${added.length}`, message: 'ok' };
        },
      }),
    );
    expect(added).toHaveLength(3);
    expect(report.added).toHaveLength(3);
    expect(report.duplicates).toHaveLength(0);
    expect(report.errors).toHaveLength(0);
  });

  it('重复职位计入 duplicates 且不视为错误', async () => {
    const report = await harvestJobs(
      { query: 'AI Agent', city: '北京' },
      makeDeps({
        addJob: async () => ({ created: false, message: 'Duplicate detected' }),
      }),
    );
    expect(report.added).toHaveLength(0);
    expect(report.duplicates).toHaveLength(3);
    expect(report.errors).toHaveLength(0);
  });

  it('单条详情失败只记该条 error,该条以快照落库,不中断整批', async () => {
    let calls = 0;
    const report = await harvestJobs(
      { query: 'AI Agent', city: '北京' },
      makeDeps({
        detail: async () => {
          calls += 1;
          if (calls === 2) throw new Error('风控弹窗');
          return toJobDetail(detailFixture[0]);
        },
      }),
    );
    expect(report.added).toHaveLength(3);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].message).toContain('风控弹窗');
  });

  it('详情失败时仍用卡片快照落库', async () => {
    const inputs: unknown[] = [];
    const report = await harvestJobs(
      { query: 'AI Agent', city: '北京' },
      makeDeps({
        detail: async () => {
          throw new Error('boom');
        },
        addJob: async (input) => {
          inputs.push(input);
          return { created: true, jobId: 'x', message: 'ok' };
        },
      }),
    );
    expect(report.added).toHaveLength(3);
    expect(report.errors).toHaveLength(3);
  });

  it('MCP 限流时熔断整批,不再刷后续职位', async () => {
    let calls = 0;
    const report = await harvestJobs(
      { query: 'AI Agent', city: '北京' },
      makeDeps({
        addJob: async () => {
          calls += 1;
          throw new Error('Rate limit exceeded. Try again in 2388s.');
        },
      }),
    );
    expect(calls).toBe(1);
    expect(report.abortedByRateLimit).toBe(true);
    expect(report.errors).toHaveLength(1);
    expect(report.added).toHaveLength(0);
  });
});
