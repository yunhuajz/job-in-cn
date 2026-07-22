# 数据契约:Job 只加 5 列,评分 ×20 映射 matchScore,字段「可筛选/可展示才成列」

**Status**: accepted(2026-07-22)

jobsync fork 的 schema 改动克制为 `Job` 新增 5 列:`evaluationReport`(评估报告 markdown)、`weekendRestStatus`(双休确认:none/pending/yes/no/no_reply)、`holidayStatus`(节假日确认,同枚举)、`greetingSentAt`(招呼语发送时间,发了即投了)、`hrReplyAt`(HR 回复时间)。评分(1.0–5.0)×20 存入原生 `matchScore`(0–100),环形分数 UI 零改动;原始分 + archetype + 合法性存 `matchData` JSON。来源平台用 `JobSource` 行(「Boss直聘」),状态机用 `JobStatus` 看板列种子,定制简历用 `Resume` 行 + 命名约定(`Boss-公司-岗位-vN`),招呼语与 HR 回复原文用 `Note`。城市(Location)与薪资(salaryRange)为原生字段,扫描时由 Boss provider 填充;JD「面议」的职位,HR 报价后更新 salaryRange 并在 Note 记来源。

## 规则

**只有需要在看板上筛选或一眼展示的字段,才配成为列**;大段文本走 matchData/Note。这让 fork 与上游 merge 的冲突面最小。

## 被拒绝的替代方案

- **为评估报告 / HR 对话单独建表(rich model)**:更「正统」,但 schema 改动大、merge 上游冲突面大;评估报告是单篇 markdown、对话原文只读存档,Note 足够承载。
