import { describe, expect, it } from 'vitest';
import { isLoggedIn } from '../../src/boss/login-state.js';

// 判定依据:zhipin.com 登录后 cookie 出现 wt2;DOM 上出现用户头像、登录入口消失
describe('isLoggedIn', () => {
  it('cookie 含 wt2 → 已登录', () => {
    expect(
      isLoggedIn({
        cookieNames: ['lastCity', 'wt2', '__zp_stoken__'],
        hasLoginEntry: false,
        hasUserAvatar: true,
      }),
    ).toBe(true);
  });

  it('无 wt2 但有用户头像且登录入口消失 → 已登录', () => {
    expect(
      isLoggedIn({
        cookieNames: ['lastCity'],
        hasLoginEntry: false,
        hasUserAvatar: true,
      }),
    ).toBe(true);
  });

  it('有登录入口且无 wt2 → 未登录', () => {
    expect(
      isLoggedIn({
        cookieNames: ['lastCity', '__zp_stoken__'],
        hasLoginEntry: true,
        hasUserAvatar: false,
      }),
    ).toBe(false);
  });

  it('头像与登录入口并存(页面结构异常)→ 保守判未登录', () => {
    expect(
      isLoggedIn({
        cookieNames: [],
        hasLoginEntry: true,
        hasUserAvatar: true,
      }),
    ).toBe(false);
  });

  it('无任何登录特征 → 未登录', () => {
    expect(
      isLoggedIn({
        cookieNames: [],
        hasLoginEntry: false,
        hasUserAvatar: false,
      }),
    ).toBe(false);
  });
});
