# 仓库结构与 vendoring 策略:job-for-claude 与三参考仓库平级,选择性搬代码

**Status**: accepted(2026-07-22)

`job-for-claude`(我们的产品)是与 `ai-job-search/`、`career-ops/`、`jobsync/` **平级**的独立 git 仓库;三个参考仓库各自独立维护、不纳入本产品版本控制。对参考仓库内容的使用分三类:**会大改的搬**(拷贝进本仓库自维护:career-ops 的 `browser-extract`/`liveness` 读侧模式 → `src/lib/`,`contacto` Greeting → `prompts/greeting.md`,`apply` 预检门 → `prompts/preflight.md`);**方法论引用**(CLAUDE.md 指向 `../career-ops/modes/` 评估框架与 ai-job-search 的 skills,Claude Code 运行时读,吃上游更新);**jobsync 作为运行中服务引用**(独立 docker,经 MCP 交互)。

## 背景与权衡

曾错误地把根目录做成包住三仓库的 umbrella 仓库,导致结构混乱、重复文件。平级 + 选择性拷贝让「我们的代码」与「参考代码」边界清晰;搬的范围刻意控制在几百行小文件,与上游脱钩的成本可接受(career-ops 周更,拷来的文件我们改到认不出,追随上游无意义)。

## 被拒绝的替代方案

- **根 umbrella 仓库 gitignore 三子仓库**:结构混乱、docs 重复、职责不清(已实践并废弃)。
- **全部引用不拷贝**:Boss provider 需要对读侧做侵入式改造(加写动作),引用无法承载。
