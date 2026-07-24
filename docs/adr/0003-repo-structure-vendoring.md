# 仓库结构与 vendoring 策略:job-for-claude 单仓库,参考代码选择性搬入

**Status**: accepted(2026-07-22;2026-07-24 修订)

`job-for-claude`(我们的产品)是**单一 git 仓库**,容纳产品全部代码;三个参考仓库(`ai-job-search/`、`career-ops/`、`jobsync/`)平级放于 `D:\AJS\` 仅作参考来源,各自独立维护、不纳入本产品版本控制。对参考仓库内容的使用分三类:**会大改的搬**(拷贝进本仓库自维护:career-ops 的 `browser-extract`/`liveness` 读侧模式 → `src/lib/`,`contacto` Greeting → `prompts/greeting.md`,`apply` 预检门 → `prompts/preflight.md`;**jobsync 整体 → `apps/web/`**,含 MCP 扩展,见 ADR-0004);**方法论引用**(CLAUDE.md 指向 `../career-ops/modes/` 评估框架与 ai-job-search 的 skills,Claude Code 运行时读,吃上游更新)。搬入的代码以 `UPSTREAM.md` 记录来源 URL + commit hash + 改动清单,此后与上游脱钩。

## 背景与权衡

曾错误地把根目录做成包住三仓库的 umbrella 仓库,导致结构混乱、重复文件。平级参考 + 选择性拷贝让「我们的代码」与「参考代码」边界清晰;搬的范围对 career-ops 刻意控制在几百行小文件,jobsync 因需深度改造(MCP 扩展 + schema + UI)而整体搬入。与上游脱钩的成本可接受:career-ops 周更但拷来的文件我们改到认不出;jobsync 的追新需求低,且 `UPSTREAM.md` 使人工追上游成为可执行流程。

**2026-07-24 修订说明**:原方案中 jobsync 为平级独立 fork(保留上游 remote);用户决策改为整体拷入本仓库,理由见 ADR-0004 修订说明。

## 被拒绝的替代方案

- **根 umbrella 仓库 gitignore 三子仓库**:结构混乱、docs 重复、职责不清(已实践并废弃)。
- **全部引用不拷贝**:Boss provider 需要对读侧做侵入式改造(加写动作),引用无法承载。
- **jobsync 平级独立 fork**(原方案,2026-07-24 废弃):见 ADR-0004。
