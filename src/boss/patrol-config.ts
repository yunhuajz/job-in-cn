export const PATROL_REST_MINUTES = 15;
export const REST_BETWEEN_CYCLES_MS = PATROL_REST_MINUTES * 60_000;

export const RISK_COOLDOWN_MINUTES = 60;
export const RISK_COOLDOWN_MS = RISK_COOLDOWN_MINUTES * 60_000;

const RISK_PATTERN =
  /异常行为|风控|AUTH_REQUIRED|操作频繁|访问过于频繁|验证码|安全验证|封禁|封控|禁止访问|\b(?:403|429)\b|连续两组搜索 0 卡片/i;

export function hasRiskSignal(output: string): boolean {
  return RISK_PATTERN.test(output);
}
