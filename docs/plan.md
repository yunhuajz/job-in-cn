# 实施计划 — job-for-claude(AJS)

> 状态:v3 · 2026-07-26(P1 完成:读侧改用 OpenCLI boss 站点适配器主动采集,ADR-0002 第二次修订;v2:读侧陪同式抽取;v1:2026-07-24,P0 已完成并提交 `253e10e`)
> 性质:执行层计划。做什么/为什么见 `PRD.md`,技术结论见 `design.md`,权衡见 `adr/`;本文档只把它们拆成可执行、可验收的步骤,不引入新设计。出现新设计分叉时走访谈(grill),不在本文档里猜。

---

## 0. P0 遗留(开工 P1 前处理)

| # | 事项 | 负责人 | 说明 |
|---|------|--------|------|
| 0.1 | Claude Code 加载 jobsync MCP | 用户 | `.mcp.json` 在仓库根,需从 `job-for-claude/` 目录启动会话(或复制到启动目录);`/mcp` 确认;首次需 approve |
| 0.2 | 正式账号 | 用户 | 在 http://localhost:3737 注册本人账号并补跑种子(`cd apps/web && npx prisma db seed`),或继续用测试账号 |
| 0.3 | Node 版本约定 | 用户拍板 | 约定 22,实际 24.15 且一切正常;统一装 nvm-windows 切 22,或把约定改为 ≥22 |
| 0.4 | MCP token 到期 | 系统 | 2027-07 前后过期,到期重签并更新 `.mcp.json` |
| 0.5 | Jobs 页 Filter by 硬编码 | 已修复 2026-07-26 | `JobsContainer.tsx` 状态选项改从 `statuses`(JobStatus 表)渲染;服务端 `getJobsList` 本就支持任意 status value,保留 PT/accepted/dismissed 三个特殊项 |
| 0.6 | ~~boss:login 专用 profile~~ | 已清理 | ADR-0002(2026-07-26):`login.ts`/`status.ts`/`browser.ts`/`login-state.ts` 及其测试已删除 |
| 0.7 | OpenCLI 通道 | 已就绪 | `@jackwener/opencli` 全局已装、Browser Bridge 扩展已连通(`opencli doctor` 全 OK)、Boss 页面被动读取实测存活 |

## 1. P1 — Boss 读侧:适配器主动采集(已完成 2026-07-26)

**交付**(PRD §7):扩展通道打通(已完成);搜索列表页 + JD 详情页 → 结构化;jobId 去重;落 jobsync(城市/薪资填充)。
**验收**:dry-run 已通过 —— `boss:harvest --query "AI Agent 工程师" --city 北京 --limit 3` 新入库 2 / 去重跳过 1 / 异常 0,数据库确认 JD 全文、城市、薪资、来源均正确。
**铁律**:主动导航已经用户明确批准(2026-07-26);滑块/验证仍由用户本人随手过;HR 消息严格只读。

### 任务分解

| # | 任务 | 产出 | 依赖 |
|---|------|------|------|
| 1.1 | ~~画像对话式填写~~ → 机制化(已完成) | `/setup-profile` 命令 + `npm run profile:check` | — |
| 1.2 | 画像加载器(已完成) | `src/lib/profile.ts`,zod 校验 | — |
| 1.3 | 扩展通道封装(已完成) | `src/boss/bridge.ts` + `src/boss/opencli.ts`:调用 `opencli boss search/detail/whoami`,JSON 解析、错误分类、stale 会话自愈、90s 超时 | 0.7 |
| 1.4 | 列表页抽取器(已完成) | `src/boss/map.ts` 纯函数:适配器 JSON → 职位卡片(标题/公司/城市/薪资/jobId);fixture 来自真实采集 | 1.3 |
| 1.5 | JD 详情页抽取器(已完成) | 同上 `map.ts`:详情 JSON → JD 全文/薪资/城市;fixture 来自真实采集 | 1.3 |
| 1.6 | 去重 + 落库管道(已完成) | `src/boss/pipeline.ts` + `src/jobsync/mcp.ts`:jobId(URL)服务端去重 → MCP `add_job`(source=Boss直聘,城市/薪资填充) | 1.4、1.5 |
| 1.7 | `npm run boss:harvest`(已完成) | 按画像「关键词 × 城市」轮询或 CLI 单组指定,打印收取报告(新 N 个/跳过 M 个重复) | 全部 |
| 1.8 | dry-run 手动验收(已完成) | 见上「验收」;用户可在 http://localhost:3737 看板复核 | 全部 |

### TDD seams(已确认原则,写测试前与用户确认细节)

- **可测**(纯函数,fixture 驱动,已落地 34 条):适配器 JSON → 卡片/详情映射;URL → jobId 提取;Boss 职位 → `add_job` 输入的映射;opencli stdout 解析(含噪音行);管道记账(新增/重复/异常)。
- **不可测**(如实说明):真实浏览器内页面状态、Boss 风控行为、jobsync MCP 传输层稳定性——靠 dry-run 与日常使用观察;适配器输出结构变化由晚间现场修理(同通道,ADR-0002)。
- fixture 获取:`opencli boss search/detail -f json` 的真实输出存 `tests/fixtures/boss/`。

### 风险与对策

| 风险 | 对策 |
|------|------|
| Boss 改页面结构,解析器失效 | 解析器纯函数化 + fixture 测试;失效时晚间现场修(同通道) |
| 扩展被风控升级干扰 | 被动读取行为面最小;兜底 = 用户复制页面文本,AI 解析(PRD §9) |
| 扫描量依赖用户浏览 | 汇总页显示「今日收取 N 个」;对话里提示未刷的关键词 |

## 2. P2 — 每日节奏(进行中:模块全部就绪,待密钥 + 验收)

- daemon 单 Node 进程(**不碰浏览器**,design.md §2,**已完成 2026-07-26**):`npm run daemon`;PID 单例(`data/daemon.pid`,重复启动返回"已在运行")、日志 `data/daemon.log`、启动补跑 + 12:30/17:30 两轮(`src/daemon/schedule.ts`)、每日备份 dev.db → `backups/dev-YYYYMMDD.db` 留 14 份(`src/daemon/backup.ts`,同日幂等);缺密钥时评分跳过不崩溃;Windows 任务计划程序 `AJS-JobHunt-Daemon` 已注册(登录触发)。**待办:HR 回复的 LLM 答案抽取回填未做(属 P3 消息捕获链路,读侧捕获已完成)。**
- 无人值守评分(design.md §4,**模块已完成 2026-07-26**):OpenAI 兼容客户端(默认 DeepSeek,`SCORING_API_KEY`),五维加权 30/25/15/25/5,总分由系统按权重计算(不信 LLM 算术),输出契约落 `evaluationReport`/`matchScore`(×20)/`matchData`,`missingInfo` 转「待确认」标记;prompt 在 `src/prompts/scoring.md`;入口 `npm run score`。配套:jobsync 新增第 6 个 MCP tool `get_job`(取纯文本 JD)。**待办:用户在根目录 .env 填 `SCORING_API_KEY` 后跑一次真评验收。**
- 「今日汇总」页(**已完成 2026-07-26**):`/dashboard/today` 只读视图,当日新入库 + 昨日遗留,推荐(≥4.0)/普通(3.0–3.9)/待评分三组,每行评分/职位(带 Boss 链接)/公司/城市/薪资/双休状态/摘要;顶部「今日收取 N 个」。0.5 的 Jobs 页硬编码筛选已修复(2026-07-26)。
- **验收**:白天收取的职位,晚上回家看到带分汇总。

## 3. P3 — 写侧 A2(核心,概要)

- 批量批准(双入口,Claude Code 对话先行):批准前 Claude Code **复述清单**,用户答「确认」才 `set_status` 落「已批准」;只认当日汇总内的职位(A2 闸,铁律)。
- 投递:AI agent 经 OpenCLI Browser Bridge 扩展驱动真实浏览器,选中 Boss 预存的一版常用语**一键发送**,不现场打字;发完回写 `greetingSentAt`。
- 人化频率:≤20 条/天、间隔 30s–3min、仅 9:00–21:00;验证码交人、风控弹窗当天熔断停投。
- HR 回复只读捕获(**读侧已完成 2026-07-26**):`npm run boss:sync-replies` 拉 chatlist/chatmsg(opencli boss 适配器),公司双向前缀匹配库内职位,HR 文本原文存 Note、回填 `hrReplyAt`(幂等,jobsync 第 7 个 MCP tool `add_hr_reply`);真机 dry-run 通过(20 会话/0 匹配,属预期——聊天列表职位未入库)。**待办:LLM 抽取双休/薪资答案回填(低置信度转人工标记)。确认问句永远由用户本人手机发出**(ADR-0001 修订)。
- jobsync UI 补勾选批准按钮(P3 才做)。
- **验收**:批准 3 个职位,自动投出且账号无恙;「待确认」职位的 HR 回复正确回填。

## 4. P4 — 简历生成(暂不展开)

方向已定(design.md §9):晚间按需生成(Claude Code 本人,非白天便宜模型),ai-job-search 方法论,PDF 存 `resumes/` 挂到职位(命名 `Boss-公司-岗位-vN`),手动拷到手机。用户提出时再展开设计。

## 5. P5 — 复盘 + 扩展(暂不展开)

拒绝模式分析上仪表盘(career-ops patterns);智联/前程无忧新 provider;可选迁 Linux 小主机。

## 附:各阶段铁律重申(任何阶段不可违背)

1. A2 人闸:发招呼前必须用户批量批准,批准前复述清单二次确认。
2. 系统对 HR 消息**严格只读**;HR 对话永远用户本人在手机 App 进行。
3. 飞书/ACP 属用户个人用法,不写入本仓库任何代码。
4. 人化频率:≤20 条/天、间隔 30s–3min,仅 9:00–21:00(针对写侧发招呼;读侧采集保持克制节奏,详情间隔 1.5s)。
5. jobsync `dev.db` 是唯一真相;schema 改动遵守 ADR-0005「可筛选/可展示才成列」。
6. ~~浏览器只被动读取,永不自动导航~~ → 2026-07-26 用户批准:读侧可经 OpenCLI boss 适配器主动采集(ADR-0002 第二次修订);写侧发送仍必须走 A2 人闸。
