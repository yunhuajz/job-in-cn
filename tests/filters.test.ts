import { describe, expect, it } from 'vitest';
import { requiresGraduateDegree } from '../src/lib/filters.js';

describe('requiresGraduateDegree', () => {
  it('硕士/博士/MBA 要求的卡片应跳过', () => {
    expect(requiresGraduateDegree('硕士')).toBe(true);
    expect(requiresGraduateDegree('博士研究生')).toBe(true);
    expect(requiresGraduateDegree('MBA')).toBe(true);
    expect(requiresGraduateDegree('天津·和平区 硕士 3-5年')).toBe(true);
  });

  it('本科及以下学历要求正常放行', () => {
    expect(requiresGraduateDegree('本科')).toBe(false);
    expect(requiresGraduateDegree('大专')).toBe(false);
    expect(requiresGraduateDegree('学历不限')).toBe(false);
    expect(requiresGraduateDegree('天津·和平区 本科 1-3年')).toBe(false);
  });

  it('空值放行', () => {
    expect(requiresGraduateDegree(undefined)).toBe(false);
    expect(requiresGraduateDegree(null)).toBe(false);
    expect(requiresGraduateDegree('')).toBe(false);
  });
});
