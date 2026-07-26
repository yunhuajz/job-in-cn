import { describe, expect, it } from 'vitest';
import { msUntilNextRun } from '../../src/daemon/schedule.js';

describe('msUntilNextRun', () => {
  it('上午时指向当天 12:30', () => {
    const now = new Date(2026, 6, 26, 9, 0, 0);
    const next = msUntilNextRun(now);
    expect(next.at.getHours()).toBe(12);
    expect(next.at.getMinutes()).toBe(30);
    expect(next.at.getDate()).toBe(26);
    expect(next.ms).toBe(3.5 * 3600 * 1000);
  });

  it('12:30 与 17:30 之间指向 17:30', () => {
    const now = new Date(2026, 6, 26, 14, 0, 0);
    const next = msUntilNextRun(now);
    expect(next.at.getHours()).toBe(17);
    expect(next.at.getMinutes()).toBe(30);
  });

  it('晚间指向明天 12:30', () => {
    const now = new Date(2026, 6, 26, 20, 0, 0);
    const next = msUntilNextRun(now);
    expect(next.at.getDate()).toBe(27);
    expect(next.at.getHours()).toBe(12);
  });

  it('跨月进位正确', () => {
    const now = new Date(2026, 6, 31, 23, 0, 0);
    const next = msUntilNextRun(now);
    expect(next.at.getMonth()).toBe(7); // 8 月(0 基)
    expect(next.at.getDate()).toBe(1);
  });
});
