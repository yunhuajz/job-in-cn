import { describe, expect, it } from 'vitest';
import { parseAddJobResult } from '../../src/jobsync/mcp.js';

describe('parseAddJobResult', () => {
  it('识别创建成功并取出 jobId', () => {
    const text =
      'Matched 考试星; Matched AI Agent 开发工程师; Created 北京; Matched Boss直聘. Job created (id: cm123abc).\n\nYou just added a job to JobSync...';
    expect(parseAddJobResult(text)).toEqual({
      created: true,
      jobId: 'cm123abc',
      message: text,
    });
  });

  it('识别重复', () => {
    const text =
      'Duplicate detected — existing job "AI Agent 开发工程师" at "考试星" (id: cm123abc). Pass allowDuplicate: true to force create. Resolutions: Matched 考试星.';
    const result = parseAddJobResult(text);
    expect(result.created).toBe(false);
    expect(result.jobId).toBeUndefined();
  });

  it('描述过短等提示仍算创建失败之外的非错误情形', () => {
    const text =
      'Matched X. Job created (id: cm9). Description too short to match (under 200 characters) — the job was still added.';
    expect(parseAddJobResult(text).created).toBe(true);
  });

  it('错误文本抛错', () => {
    expect(() => parseAddJobResult('Error: something failed')).toThrow(
      /something failed/,
    );
    expect(() =>
      parseAddJobResult('Rate limit exceeded. Try again in 30s.'),
    ).toThrow(/Rate limit/);
  });
});
