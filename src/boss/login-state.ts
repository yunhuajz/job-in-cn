// 登录态判定(纯函数,fixture 可测):
// zhipin.com 登录后 cookie 出现 wt2;DOM 上出现用户头像、登录入口消失。
// 头像与登录入口并存视为结构异常,保守判未登录,继续等待。
export interface LoginIndicators {
  cookieNames: string[];
  hasLoginEntry: boolean;
  hasUserAvatar: boolean;
}

export function isLoggedIn(indicators: LoginIndicators): boolean {
  if (indicators.cookieNames.includes('wt2')) {
    return true;
  }
  return indicators.hasUserAvatar && !indicators.hasLoginEntry;
}
