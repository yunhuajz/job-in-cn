# 扩展 jobsync 的 MCP 能力:fork jobsync 树内改,不做旁路 bridge

**Status**: accepted(2026-07-22)

为让 Claude Code 能把评估结果、定制简历、投递状态写入 jobsync 并在 UI 展示,需要给 jobsync 的 MCP server 增加 tool(其原生仅 `add_job`/`add_question`/`save_match_result` 三个)。决定**直接修改 vendored 的 `../jobsync/`(fork)**,在 `src/lib/mcp/tools/` 内扩展 tool 面,必要时扩展 Prisma schema。

## 背景与权衡

fork 让所有写入经过 jobsync 自己的 ORM/校验/加密,数据完整性与 UI 一致性最好;代价是与上游分家,需周期性 merge 上游(jobsync 周更)。缓解:改动尽量集中在 `src/lib/mcp/tools/` 等边缘目录,降低冲突概率。

## 被拒绝的替代方案

- **bridge(独立服务直读写 jobsync 的 SQLite)**:jobsync 保持 pristine,但双进程写一个 SQLite 文件有写锁冲突;jobsync 升级改库结构时 bridge 按旧 schema 写入即崩(schema 漂移);且绕过 jobsync 的业务校验可能产生 UI 无法渲染的脏数据。
- **仅用现有 3 个 MCP tool,评估/简历不进 jobsync**:看板看不到评分与生成物,「jobsync 当显示层」的目标残缺,还需自建展示界面,工作量更大。

## 后果

- `../jobsync/` 成为受控 fork:保留上游 remote,定期 `git merge`,冲突集中在 MCP tool 与 schema 文件。
- 需建立「我们改过哪些文件」清单,降低 merge 认知成本。
