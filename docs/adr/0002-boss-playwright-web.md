# Boss 直聘自动化:读侧 Playwright 脚本、写侧 Claude Code + chrome-devtools MCP、人化频率、验证码交人、熔断

**Status**: accepted(2026-07-22;2026-07-24 修订)

Boss provider 分两侧实现。**读侧**(扫描 / JD 抽取 / 消息捕获):daemon 无人值守执行 Playwright 脚本 —— stealth 插件 + 专用 Chrome profile 持久登录(QR 扫一次)+ 人化频率 + 真实 UA + 随机间隔,只读不点。**写侧**(发招呼语):用户晚间批量批准后,由 **Claude Code 通过 chrome-devtools MCP** 驱动同一专用 Chrome profile,选中 Boss 预存的一版常用语一键发送 —— 用户全程在场,AI 可实时识别验证码/滑块/风控弹窗并交人处理,检测到风控立即熔断当天停投。频率约束不变:每日 ≤20 条招呼、间隔随机 30s–3min、仅 9:00–21:00 活跃。

## 背景与权衡

团队(用户与 Claude Code)只掌握 Playwright,统一技术栈优先级高;慢是 feature —— 慢 = 像人 = 不封。单账号、用本人真实账号,不上小号矩阵。

**2026-07-24 修订说明**:写侧原定由 Playwright 脚本自动发送,改为 Claude Code + chrome-devtools MCP 驱动。理由:用户选择 Claude Code 为核心正是因为 AI 能看着页面操作浏览器 —— Boss 改版导致选择器失效时 AI 现场适配,验证码/滑块出现时自然交人(用户晚间本就在场),风控弹窗可被 AI 识别而非靠脚本硬编码规则。读侧任务机械重复且白天无人在场,仍由 daemon 脚本承担;读侧脚本因 Boss 改版失效时,同样用 chrome-devtools MCP 作为修理工具。两侧共享同一专用 Chrome profile,QR 登录一次通用。

## 被拒绝的替代方案

- **逆向 Boss 内部 API**:请求带设备签名/加密,逆向难且官方一改即失效,风控对纯 API 调用最敏感,封号最快。
- **桌面客户端 UI 自动化(pyautogui/UIA)**:仅 Windows、需前台 GUI 会话、按坐标点易崩、读不到结构化数据、原生文件对话框难传简历、无法容器化。
- **客户端 CDP 挂接(connectOverCDP)**:保留为备案 —— 仅当网页端实际被封且验证客户端为 Electron 时启用。
- **写侧也由 daemon 脚本自动发送**(原方案,2026-07-24 废弃):选择器脆弱、无法识别验证码与风控弹窗、丢失了「AI 看页面操作」这一选 Claude Code 为核心入口的根本理由。
