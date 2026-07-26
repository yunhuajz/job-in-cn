// daemon 时刻表(design.md §2):默认 12:30 / 17:30 两轮

export const RUN_TIMES = ['12:30', '17:30'] as const;

export interface NextRun {
  ms: number;
  at: Date;
}

// 距下一次定时运行的毫秒数;今天的都过了则取明天第一轮
export function msUntilNextRun(
  now: Date,
  times: readonly string[] = RUN_TIMES,
): NextRun {
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      const at = new Date(now);
      at.setDate(at.getDate() + dayOffset);
      at.setHours(hour, minute, 0, 0);
      if (at.getTime() > now.getTime()) candidates.push(at);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  const at = candidates[0];
  return { ms: at.getTime() - now.getTime(), at };
}
