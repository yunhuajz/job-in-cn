import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LocalJobs from '@/components/local/LocalJobs';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('点击未投递岗位的原网页链接时自动标记为已投递', async () => {
  const calls: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    if (options?.method === 'PATCH') {
      calls.push(JSON.parse(options.body));
      return Response.json({ updated: 1 });
    }
    return Response.json({
      total: 1, pages: 1, sources: ['前程无忧51job'],
      jobs: [{ id: 'job-1', title: '前端工程师', company: '测试公司', location: '天津', salary: '10-15K', source: '前程无忧51job', weekend: 'unknown', score: null, scoreReason: '', evaluationReport: null, matchData: null, url: 'https://jobs.test/job-1', progress: 'draft', firstCollectedAt: '2026-09-10T00:00:00.000Z', collectedAt: '2026-09-10T00:00:00.000Z' }],
    });
  }));

  render(<LocalJobs />);
  fireEvent.click(await screen.findByRole('link', { name: '打开原招聘页：前端工程师' }));

  await waitFor(() => expect(calls).toContainEqual({ ids: ['job-1'], progress: 'applied' }));
});

it('点击已推进岗位的原网页链接时不降低岗位状态', async () => {
  const patchCalls: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    if (options?.method === 'PATCH') {
      patchCalls.push(JSON.parse(options.body));
      return Response.json({ updated: 1 });
    }
    return Response.json({
      total: 1, pages: 1, sources: ['Boss 直聘'],
      jobs: [{ id: 'job-2', title: '后端工程师', company: '测试公司', location: '北京', salary: '15-20K', source: 'Boss 直聘', weekend: 'yes', score: 80, scoreReason: '', evaluationReport: null, matchData: null, url: 'https://jobs.test/job-2', progress: 'interview', firstCollectedAt: '2026-09-10T00:00:00.000Z', collectedAt: '2026-09-10T00:00:00.000Z' }],
    });
  }));

  render(<LocalJobs />);
  fireEvent.click(await screen.findByRole('link', { name: '打开原招聘页：后端工程师' }));

  expect(patchCalls).toEqual([]);
});
