# 扩展 jobsync 的 MCP 能力:整体拷入本仓库自维护,不做旁路 bridge、不做独立 fork

**Status**: accepted(2026-07-22;2026-07-24 修订)

为让 Claude Code 能把评估结果、定制简历、投递状态写入 jobsync 并在 UI 展示,需要给 jobsync 的 MCP server 增加 tool(其原生仅 `add_job`/`add_question`/`save_match_result` 三个)。决定**将 jobsync 整体拷入 `job-for-claude` 仓库(`apps/web/`)自维护**,在 `src/lib/mcp/tools/` 内扩展 tool 面,必要时扩展 Prisma schema。拷入时建 `apps/web/UPSTREAM.md`,记录来源仓库 URL + commit hash 及「我们改过的文件」清单;此后与上游脱钩,上游更新靠人工按 hash diff 评估搬运。

## 背景与权衡

fork(拷入本仓库)让所有写入经过 jobsync 自己的 ORM/校验/加密,数据完整性与 UI 一致性最好;单仓库统一版本控制,免除跨仓库协调的日常心智负担,与 ADR-0003 对 career-ops 的「会大改的搬」策略逻辑统一。代价是与上游分家、失去 git merge 能力 —— 用 `UPSTREAM.md` 的来源 hash + 改动清单把「追上游」变成可执行的人工流程;缓解同前:改动尽量集中在 `src/lib/mcp/tools/` 等边缘目录。

**2026-07-24 修订说明**:原方案为修改平级独立 fork `../jobsync/`(保留上游 remote 定期 merge)。用户决策改为整体拷入本仓库:单用户项目下,跨仓库协调成本天天发生,上游更新成本偶尔发生,单一仓库「所有代码一眼看全」更优。

## 被拒绝的替代方案

- **bridge(独立服务直读写 jobsync 的 SQLite)**:jobsync 保持 pristine,但双进程写一个 SQLite 文件有写锁冲突;jobsync 升级改库结构时 bridge 按旧 schema 写入即崩(schema 漂移);且绕过 jobsync 的业务校验可能产生 UI 无法渲染的脏数据。
- **仅用现有 3 个 MCP tool,评估/简历不进 jobsync**:看板看不到评分与生成物,「jobsync 当显示层」的目标残缺,还需自建展示界面,工作量更大。
- **平级独立 fork 保留上游 remote**(原方案,2026-07-24 废弃):跨仓库协调的日常心智负担高于偶尔的人工追上游;单仓库更适合单用户项目。

## 后果

- `apps/web/` 成为本仓库内自维护代码;`UPSTREAM.md` 记录来源与改动清单,追上游为人工流程。
- jobsync 升级不再可能 `git merge`,需要时按 `UPSTREAM.md` 的 hash 人工 diff 评估。
