import { resolve } from 'node:path';
import {
  chromium,
  type BrowserContext,
  type LaunchOptions,
  type Page,
} from 'playwright';
import type { LoginIndicators } from './login-state.js';

// ADR-0002:读写两侧共享专用 Chrome profile,QR 登录一次通用
export const PROFILE_DIR = resolve('data/chrome-profile');
export const LOGIN_URL = 'https://www.zhipin.com';

// 优先系统真 Chrome:真实浏览器指纹更像人,降低风控(ADR-0002 人化/风控);
// 没装 Chrome 时回退 Playwright bundled Chromium。
export function buildLaunchOptions(
  hasSystemChrome: boolean,
  headless: boolean,
): LaunchOptions {
  const options: LaunchOptions = { headless };
  if (hasSystemChrome) {
    options.channel = 'chrome';
  }
  return options;
}

export async function launchBossContext(
  headless: boolean,
): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(
      PROFILE_DIR,
      buildLaunchOptions(true, headless),
    );
  } catch (error) {
    const message = (error as Error).message;
    if (!/Executable doesn't exist|distribution 'chrome' is not found/i.test(message)) {
      throw error;
    }
    console.log('未检测到系统 Chrome,回退使用 Playwright 内置 Chromium。');
    return chromium.launchPersistentContext(
      PROFILE_DIR,
      buildLaunchOptions(false, headless),
    );
  }
}

export async function collectIndicators(
  context: BrowserContext,
  page: Page,
): Promise<LoginIndicators> {
  const cookies = await context.cookies(LOGIN_URL);
  const hasLoginEntry = (await page.locator('text=登录/注册').count()) > 0;
  const hasUserAvatar =
    (await page.locator('.nav-figure img, .user-figure img').count()) > 0;
  return {
    cookieNames: cookies.map((c) => c.name),
    hasLoginEntry,
    hasUserAvatar,
  };
}
