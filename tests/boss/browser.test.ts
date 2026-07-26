import { describe, expect, it } from 'vitest';
import { buildLaunchOptions } from '../../src/boss/browser.js';

describe('buildLaunchOptions', () => {
  it('有系统 Chrome → 使用 channel chrome(真实浏览器指纹,ADR-0002)', () => {
    expect(buildLaunchOptions(true, false)).toEqual({
      channel: 'chrome',
      headless: false,
    });
  });

  it('无系统 Chrome → 回退 bundled Chromium(不带 channel)', () => {
    const options = buildLaunchOptions(false, false);
    expect(options).not.toHaveProperty('channel');
    expect(options.headless).toBe(false);
  });

  it('headless 模式透传(status 检查用)', () => {
    expect(buildLaunchOptions(true, true)).toEqual({
      channel: 'chrome',
      headless: true,
    });
  });
});
