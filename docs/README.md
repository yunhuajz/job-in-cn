# Docs

`job-for-claude` 的产品文档(PRD、ADR 等)。

> 三个参考仓库的分析文档在 AJS 层:`../docs/`(与本项目平级的 `D:\AJS\docs\`)。

## 参考仓库(vendored,平级独立维护)

与本项目平级、位于 `D:\AJS\` 下的三个参考仓库:

- `../ai-job-search/` — Claude Code 求职框架(TypeScript)
- `../career-ops/` — 招聘门户扫描 / CV 定制(JavaScript)
- `../jobsync/` — 自托管投递追踪 Web 应用(Next.js)

三者各自带 `.git`,在各自目录里独立 `git pull` 更新;**不纳入本仓库版本控制**。
本项目对它们的使用方式(引用 vs 搬代码)见 `docs/adr/`。
