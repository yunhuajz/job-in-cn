import { isLoggedIn } from './login-state.js';
import { LOGIN_URL, collectIndicators, launchBossContext } from './browser.js';

// npm run boss:status — headless 检查专用 profile 的登录态
// exit 0 已登录 / exit 1 未登录 / exit 2 检查失败(风控、跳转异常等)
async function main(): Promise<void> {
  const context = await launchBossContext(true);
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(LOGIN_URL);
    const loggedIn = isLoggedIn(await collectIndicators(context, page));
    console.log(loggedIn ? '已登录' : '未登录');
    process.exitCode = loggedIn ? 0 : 1;
  } catch (error) {
    console.log(`状态检查失败:${(error as Error).message}`);
    process.exitCode = 2;
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  console.log(`状态检查失败:${(error as Error).message}`);
  process.exitCode = 2;
});
