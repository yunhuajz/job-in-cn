import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_GREET_LIMIT,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  detectRiskControl,
  greetOne,
  isWithinSendWindow,
  pickDelayMs,
  runGreetingBatch,
  type GreetCandidate,
  type GreetIO,
} from '../../src/boss/greet.js';

const candidate: GreetCandidate = {
  id: 'job-1',
  jobTitle: 'AI Agent 工程师',
  company: '示例科技',
  jobUrl: 'https://www.zhipin.com/job_detail/abc.html',
};

function makeIo(overrides: Partial<GreetIO> = {}): GreetIO {
  return {
    openJobPage: vi.fn(async () => {}),
    readPageSignals: vi.fn(async () => '职位详情 立即沟通'),
    clickChatButton: vi.fn(async () => 'clicked' as const),
    verifyChatOpened: vi.fn(async () => true),
    markSent: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    now: () => new Date('2026-07-26T10:00:00'),
    ...overrides,
  };
}

describe('发送窗口与节奏', () => {
  it('仅 9:00–21:00 可发', () => {
    expect(isWithinSendWindow(new Date('2026-07-26T08:59:00'))).toBe(false);
    expect(isWithinSendWindow(new Date('2026-07-26T09:00:00'))).toBe(true);
    expect(isWithinSendWindow(new Date('2026-07-26T20:59:00'))).toBe(true);
    expect(isWithinSendWindow(new Date('2026-07-26T21:00:00'))).toBe(false);
  });

  it('间隔落在 30s–3min', () => {
    expect(pickDelayMs(() => 0)).toBe(MIN_DELAY_MS);
    expect(pickDelayMs(() => 0.9999)).toBeLessThan(MAX_DELAY_MS);
  });

  it('日限额常量 ≤20', () => {
    expect(DAILY_GREET_LIMIT).toBeLessThanOrEqual(20);
  });
});

describe('风控识别', () => {
  it('命中验证/风控信号', () => {
    expect(detectRiskControl('请完成安全验证')).toBe(true);
    expect(detectRiskControl('拖动下方滑块完成拼图')).toBe(true);
    expect(detectRiskControl('https://www.zhipin.com/?_security_check=1')).toBe(
      true,
    );
    expect(detectRiskControl('操作频繁,请稍后再试')).toBe(true);
  });

  it('正常职位页不误报', () => {
    expect(detectRiskControl('职位详情 立即沟通 双休 五险一金')).toBe(false);
  });
});

describe('greetOne', () => {
  it('风控页直接短路,不点按钮', async () => {
    const io = makeIo({
      readPageSignals: vi.fn(async () => '安全验证 滑块'),
    });
    const outcome = await greetOne(candidate, io);
    expect(outcome).toBe('risk-control');
    expect(io.clickChatButton).not.toHaveBeenCalled();
    expect(io.markSent).not.toHaveBeenCalled();
  });

  it('已沟通过的职位跳过', async () => {
    const io = makeIo({
      clickChatButton: vi.fn(async () => 'already' as const),
    });
    expect(await greetOne(candidate, io)).toBe('already-communicated');
    expect(io.markSent).not.toHaveBeenCalled();
  });

  it('找不到按钮记 no-button', async () => {
    const io = makeIo({
      clickChatButton: vi.fn(async () => 'missing' as const),
    });
    expect(await greetOne(candidate, io)).toBe('no-button');
  });

  it('点击后验证失败记 failed,不回写', async () => {
    const io = makeIo({
      verifyChatOpened: vi.fn(async () => false),
    });
    expect(await greetOne(candidate, io)).toBe('failed');
    expect(io.markSent).not.toHaveBeenCalled();
  });

  it('成功路径回写 greetingSentAt', async () => {
    const io = makeIo();
    expect(await greetOne(candidate, io)).toBe('sent');
    expect(io.markSent).toHaveBeenCalledWith('job-1');
  });
});

describe('runGreetingBatch', () => {
  const three: GreetCandidate[] = [
    candidate,
    { ...candidate, id: 'job-2' },
    { ...candidate, id: 'job-3' },
  ];

  it('全部成功,条间有间隔', async () => {
    const io = makeIo();
    const report = await runGreetingBatch(three, io, () => 0.5);
    expect(report.sent).toBe(3);
    expect(report.stoppedBy).toBe('completed');
    // 3 条之间有 2 个节奏间隔 + 每条点击后 2s 验证等待
    const delays = (io.sleep as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .filter((ms) => ms >= MIN_DELAY_MS);
    expect(delays).toHaveLength(2);
    for (const ms of delays) {
      expect(ms).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      expect(ms).toBeLessThan(MAX_DELAY_MS);
    }
  });

  it('风控立即熔断,不再投后续', async () => {
    const io = makeIo({
      readPageSignals: vi.fn(async () => '请完成安全验证'),
    });
    const report = await runGreetingBatch(three, io);
    expect(report.stoppedBy).toBe('risk-control');
    expect(report.results).toHaveLength(1);
    expect(report.sent).toBe(0);
  });

  it('连续失败 2 次熔断', async () => {
    const io = makeIo({
      verifyChatOpened: vi.fn(async () => false),
    });
    const report = await runGreetingBatch(three, io);
    expect(report.stoppedBy).toBe('failures');
    expect(report.results).toHaveLength(2);
  });

  it('窗口关闭前一条都不投', async () => {
    const io = makeIo({ now: () => new Date('2026-07-26T22:00:00') });
    const report = await runGreetingBatch(three, io);
    expect(report.stoppedBy).toBe('window-closed');
    expect(report.results).toHaveLength(0);
  });

  it('单条抛异常记 failed 并继续', async () => {
    const io = makeIo({
      openJobPage: vi
        .fn()
        .mockRejectedValueOnce(new Error('tab crashed'))
        .mockResolvedValue(undefined),
    });
    const report = await runGreetingBatch(three, io);
    expect(report.results[0].outcome).toBe('failed');
    expect(report.results[0].detail).toBe('tab crashed');
    expect(report.sent).toBe(2);
    expect(report.stoppedBy).toBe('completed');
  });
});
