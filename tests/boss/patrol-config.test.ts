import { describe, expect, it } from 'vitest';
import {
  PATROL_REST_MINUTES,
  RISK_COOLDOWN_MINUTES,
  REST_BETWEEN_CYCLES_MS,
  hasRiskSignal,
} from '../../src/boss/patrol-config.js';

describe('巡逻配置', () => {
  it('轮次之间休息 15 分钟', () => {
    expect(PATROL_REST_MINUTES).toBe(15);
    expect(REST_BETWEEN_CYCLES_MS).toBe(15 * 60_000);
  });

  it('识别平台风控信号并设置 60 分钟冷却', () => {
    expect(RISK_COOLDOWN_MINUTES).toBe(60);
    expect(hasRiskSignal('访问过于频繁,请稍后再试')).toBe(true);
    expect(hasRiskSignal('收取完成:新入库 2 · 重复 3')).toBe(false);
  });
});
