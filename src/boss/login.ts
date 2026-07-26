import { isLoggedIn } from './login-state.js';
import { LOGIN_URL, collectIndicators, launchBossContext } from './browser.js';

const TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

function isBrowserClosed(error: unknown): boolean {
  return (error as Error).message.includes('has been closed');
}

async function main(): Promise<void> {
  const context = await launchBossContext(false);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(LOGIN_URL);

  // 幂等:已登录时直接报告退出
  if (isLoggedIn(await collectIndicators(context, page))) {
    console.log('已登录,无需重复扫码。');
    await context.close();
    return;
  }

  console.log('请用手机 Boss 直聘 App 扫码登录,登录后本窗口会自动关闭…');
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await page.waitForTimeout(POLL_INTERVAL_MS);
      if (isLoggedIn(await collectIndicators(context, page))) {
        console.log('登录成功,登录态已保存到 data/chrome-profile/。');
        await context.close();
        return;
      }
    } catch (error) {
      if (isBrowserClosed(error)) {
        console.log('登录窗口已关闭,登录未完成;准备好后重新运行 npm run boss:login');
        process.exitCode = 2;
        return;
      }
      // 页面跳转期间 DOM 不可读,跳过本轮继续轮询
    }
  }

  console.log(
    '登录超时(5 分钟)。请重新运行 npm run boss:login 并及时用手机扫码;' +
      '若页面一直无二维码,请检查网络后重试。',
  );
  await context.close();
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  if (isBrowserClosed(error)) {
    console.log('登录窗口已关闭,登录未完成;准备好后重新运行 npm run boss:login');
    process.exitCode = 2;
    return;
  }
  console.error(`启动浏览器失败:${(error as Error).message}`);
  process.exitCode = 1;
});
