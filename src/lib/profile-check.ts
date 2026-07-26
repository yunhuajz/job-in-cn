import { loadProfile } from './profile.js';
import { formatProfile } from './profile-format.js';

// npm run profile:check — 加载默认路径画像并打印;失败打印中文错误,退出码 1
try {
  const profile = loadProfile();
  console.log(formatProfile(profile));
  console.log('\n画像校验通过。');
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
