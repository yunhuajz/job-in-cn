# Boss 直聘自动化:Playwright 网页端 + 人化频率 + 验证码交人 + 熔断

**Status**: accepted(2026-07-22)

Boss provider 用 **Playwright 驱动 zhipin.com 网页端**实现:stealth 插件 + 真实浏览器 profile 持久登录(QR 扫一次)+ 人化频率(每日 ≤20 条招呼、间隔随机 30s–3min、仅 9:00–21:00 活跃)+ 遇到滑块/短信验证暂停交人手动过 + 检测到风控弹窗立即熔断当天停投。读侧复用 career-ops `browser-extract.mjs` 的模式(headless + 真实 UA + 随机间隔,只读不点)。

## 背景与权衡

团队(用户与 Claude Code)只掌握 Playwright,统一技术栈优先级高;慢是 feature —— 慢 = 像人 = 不封。单账号、用本人真实账号,不上小号矩阵。

## 被拒绝的替代方案

- **逆向 Boss 内部 API**:请求带设备签名/加密,逆向难且官方一改即失效,风控对纯 API 调用最敏感,封号最快。
- **桌面客户端 UI 自动化(pyautogui/UIA)**:仅 Windows、需前台 GUI 会话、按坐标点易崩、读不到结构化数据、原生文件对话框难传简历、无法容器化。
- **客户端 CDP 挂接(connectOverCDP)**:保留为备案 —— 仅当网页端实际被封且验证客户端为 Electron 时启用。
