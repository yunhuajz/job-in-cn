# UPSTREAM

本目录代码 vendored 自上游开源项目 **jobsync**，作为 job-for-claude 单仓库 `apps/web` 的地基。

## 来源

- 上游仓库:https://github.com/Gsync/jobsync.git
- 拷贝基点 commit:`1a8647bdb0108b26481b509323d503d0ab433184`(version 1.1.14)
- 拷贝日期：2026-07-24

## 拷贝时的排除项

按用户决定，本次拷入偏离「整体拷入」，**以下上游目录未拷入**:

- `e2e/` — Playwright 端到端测试
- `evals/` — promptfoo 评估套件
- `screenshots/` — README 用截图

注意：上游 `package.json` 中 `test:e2e`、`eval:*` 脚本以及 `playwright.config.ts`(`testDir: "./e2e"）仍引用这些目录，当前处于失效状态，后续需删除/改写这些脚本或补拷目录。

其他按惯例排除的产物（上游根目录本就不存在，属防御性排除）:`.git/`、`node_modules/`、`.next/`、`dev.db*`。

上游根目录**没有**真实 `.env` 文件，只有模板 `.env.example`（已拷入）。上游未提供其它 env 模板。

## 我们改过的文件

（空 —— 拷贝基线上尚未做任何本地修改。每改动一个文件，请在此登记路径与改动原因。)

### 2026-07-24 — AJS 5 个 MCP tool + 「已批准」状态种子（P0 地基第 4 项）

- `src/models/mcp.schema.ts` — 新增 5 个 AJS tool 的 zod 输入 schema(update_evaluation / set_status / save_resume_version / add_note / list_jobs)。
- `src/lib/mcp/tools/updateEvaluation.ts` — 新 tool:写评分产物（evaluationReport + matchScore×20 + matchData JSON)。
- `src/lib/mcp/tools/setStatus.ts` — 新 tool：按名称设置 JobStatus，只认库中已有状态。
- `src/lib/mcp/tools/saveResumeVersion.ts` — 新 tool：为 Job 建 `Boss-公司-岗位-vN` Resume 并挂接（ADR-0005)。
- `src/lib/mcp/tools/addNote.ts` — 新 tool：给 Job 加 Note（招呼语/HR 回复原文载体）,逻辑镜像 `note.actions.ts` 的 addNote（该 action 是 session 绑定，MCP 路径用 token 的 userId)。
- `src/lib/mcp/tools/listJobs.ts` — 新 tool：今日汇总/批准清单数据源，按 status/minMatchScore/since 过滤，limit 上限 50。
- `src/app/api/mcp/route.ts` — 注册上述 5 个 tool，沿用 `jobs:write` scope + safeParse 校验模式。
- `src/lib/ajs/seedAjsData.ts` — `AJS_JOB_STATUSES` 补「已批准」(value: approved),design.md §5 批准落状态所需。
- `__tests__/ajsSeed.spec.ts`、`__tests__/mcpUpdateEvaluation.spec.ts`、`__tests__/mcpSetStatus.spec.ts`、`__tests__/mcpSaveResumeVersion.spec.ts`、`__tests__/mcpAddNote.spec.ts`、`__tests__/mcpListJobs.spec.ts` — 对应测试。

### 2026-07-26 — MCP tool 增至 8 个 + 限流放宽 + 限流熔断

- `src/lib/mcp/tools/getJob.ts`、`addHrReply.ts`、`markGreetingSent.ts` — 新 tool:get_job(取纯文本 JD)、add_hr_reply(HR 回复只读捕获)、mark_greeting_sent(A2 闸:仅 approved 可回写 greetingSentAt)。
- `src/lib/mcp/tools/listJobs.ts` — 返回行补 `hrReplyAt`/`greetingSentAt`。
- `src/lib/constants.ts` — `MCP_RATE_LIMIT_MAX` 30 → 300:一轮 boss:harvest 约 100+ 次 add_job,30/小时会把整批打成限流错误。
- `src/components/myjobs/JobsContainer.tsx` — Filter by 下拉改读 JobStatus 表(原硬编码 applied/interview/...)。

### 2026-07-29 — 界面中文化(用户要求)

- 导航/外壳:`src/lib/constants.ts`(SIDEBAR_LINKS)、`src/components/Sidebar.tsx`、`Header.tsx`、`ProfileDropdown.tsx`。
- 总览页:`src/app/dashboard/page.tsx`、`src/components/dashboard/*`(JobsAppliedCard/NumberCardToggle/TopActivitiesCard/RecentCardToggle/WeeklyBarChartToggle)。
- 岗位页:`src/components/myjobs/*`(JobsContainer/MyJobsTable/JobDetails/AddJob)、`src/components/RecordsCount.tsx`、`src/models/addJobForm.schema.ts`(校验文案)。
- 任务/活动页:`src/components/tasks/TasksTable.tsx`、`TaskForm.tsx`、`src/components/activities/ActivitiesTable.tsx`、`src/hooks/useActivitySwitchConfirm.tsx`、`src/components/DeleteAlertDialog.tsx`。
- 登录页:`src/components/auth/AuthCard.tsx`、`SigninForm.tsx`、`src/models/signinForm.schema.ts`、`src/app/(auth)/signin/page.tsx`。
- `__tests__/*` — 同步更新断言为中文文案;admin 深处页面(公司/标签管理等)与 profile 简历模块暂未翻译。

## 追上游流程

要跟进上游时，用 commit hash 在上游 `git diff <基点hash>..HEAD` 人工评估变更，再决定逐个文件搬入或跳过；本清单中的本地改动需逐条比对避免覆盖。
