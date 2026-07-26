# 技术设计 — job-for-claude(AJS)

> 状态:v2 · 2026-07-26(读侧改陪同式抽取、写侧改浏览器扩展通道,见 ADR-0002 修订;v1:2026-07-24 设计访谈(grill)的全部结论)
> 性质:技术设计文档,承接 PRD(做什么)与 ADR(关键权衡)之间的细节层。术语见 `../CONTEXT.md`。

---

## 1. 运行时拓扑

全部跑在用户 Windows PC,单仓库、零容器、零云依赖:

```
            用户(浏览 Boss / 晚间对话 / 手机 HR 对话)
                │ 真人浏览              ▲
                ▼                       │ 被动读取(抽取/收回复)
        ┌───────────────┐  OpenCLI    ┌─┴────────────┐
        │ 真实浏览器      │◄──────────►│ AI agent      │
        │ + Browser Bridge│  扩展通道   │ (Kimi/Claude) │
        │ (Boss 登录态)   │  写侧:发招呼语└─┬──────────┬─┘
        └───────────────┘              │          │
                                       ▼          ▼ 状态读写
                              ┌─────────────┐  ┌──────────────────┐
                              │ daemon       │  │ apps/web(jobsync)│
                              │ 评分/备份     │  │ MCP server + 看板 │
                              │ (不碰浏览器)  │  │ dev.db = 唯一真相 │
                              └─────────────┘  └──────────────────┘
```

**分工铁律**:

| 侧 | 驱动者 | 何时运行 | 人在场? |
|---|---|---|---|
| 读侧(抽取 / JD / 消息捕获) | 用户浏览 + 扩展被动读取 | 用户刷 Boss 时 | **是**(浏览本身是真人动作) |
| 评分 | daemon 调 LLM API | 白天定时 | 否 |
| 写侧(发招呼语) | AI agent + 浏览器扩展 | 晚间批准后 | **是** |
| HR 对话(问双休/发简历/聊天) | 用户本人,手机 Boss App | 随时 | 是 |

登录态:用用户日常浏览器的既有 Boss 会话,**无专用 profile、无 QR 扫码环节**。所有「程序主动驱动浏览器」的通道(Playwright/CDP)均被 Boss 风控识别,已于 2026-07-26 实测证伪(ADR-0002)。

## 2. daemon(评分/备份常驻进程)

单 Node 进程,由 Windows 任务计划程序在登录时启动;`/start-job-hunt` / `/stop-job-hunt`(Claude Code 命令)管理启停;PID 写 `data/daemon.pid`,日志写 `data/daemon.log`。重复启动返回"已在运行"。**daemon 不碰浏览器**(ADR-0002)。

**职责**:
1. 定时检查新入库未评分职位 → 调 LLM 评分 → 写回 jobsync;
2. LLM 抽取 HR 回复(Note 原文)中的双休/薪资答案回填(低置信度转人工标记);
3. 每天最后一次运行后备份 `dev.db` → `backups/dev-YYYYMMDD.db`,保留 14 份。

**时刻表**(YAML 可配):

| 触发 | 默认 | 说明 |
|---|---|---|
| 开机补评 | Windows 登录时 | 补前夜入库未评分的;「错过补跑」由任务计划程序负责 |
| 白天评分 1 | 12:30 | |
| 白天评分 2 | 17:30 | 18:30 前汇总就绪 |

**异常处理**:不主动外发。错误写日志 + jobsync Note;阻断性问题(连续两次评分失败)在今日汇总页顶部显示横幅;晚间 Claude Code 口述报告。

## 3. 搜索与抽取

**搜索是人的动作**:用户在日常浏览器里按自己的关键词 × 城市搜索、使用 Boss 原生过滤器、翻页、点详情 —— 系统不做任何自动导航。画像 `targetRoles`/`preferredCities`/`salaryFloor`/`experience` 是**给用户的建议清单**(汇总页/对话里提示「今天还没刷这几个词」),不是机器的轮询队列。

**抽取是机器的动作**(陪同式,扩展被动读当前页 DOM):
- 搜索列表页:提取本页职位卡片(标题、公司、城市、薪资、jobId);
- JD 详情页:提取 JD 全文 + 薪资 + 城市;
- **jobId 去重**(URL 提取),已入库跳过;
- 落库时填充城市(Location)与薪资(salaryRange),来源「Boss直聘」;
- 遇滑块/验证页面:用户本人随手过掉(人本来就在场),系统不处理;
- 抽取失败(页面结构变了):当前页跳过并记日志,晚上 Claude Code 用扩展现场修理选择器(ADR-0002 同通道)。

## 4. 评分

**后端**:OpenAI 兼容接口抽象,模型是画像 YAML 里的一行配置:

```yaml
scoring:
  provider: openai-compatible
  baseURL: "https://api.deepseek.com/v1"   # Bonsai 本地: http://localhost:8080/v1
  model: "deepseek-chat"
  apiKeyEnv: "SCORING_API_KEY"
```

P2 默认 DeepSeek;Bonsai 27B 本地部署为独立后续任务,切换只改 YAML。

**五维加权**(权重在画像 `scoring.weights` 可自调):

| 维度 | 权重 | 规则 |
|---|---|---|
| 硬性条件(双休/节假日) | 30% | JD 明写单休/大小周重扣;**没写不扣分**,记入 `missingInfo` |
| 薪资匹配 | 25% | "面议"记中性 |
| 公司质量 | 15% | 含 `avoidKeywords` 命中惩罚 |
| 技能匹配 | 25% | 画像 `skills` vs JD |
| 城市/通勤 | 5% | 仅参考项 |

**输出契约**(LLM 返回 JSON):

```json
{
  "score": 4.2,
  "dimensions": { "constraints": 4.0, "salary": 3.0, "company": 3.5, "skills": 4.5, "city": 5.0 },
  "missingInfo": ["weekend_rest"],
  "legality": "ok",
  "summary": "AI Agent 方向强匹配,薪资下限偏低,JD 未写双休"
}
```

`score` ×20 → `matchScore`;维度 + summary → `evaluationReport` / `matchData`;`missingInfo` → 「待确认」标记。prompt 模板在 `src/prompts/scoring.md`。阈值(画像可配):≥3.0 入今日汇总,≥4.0 标"推荐";低于阈值仍落库不进汇总。

## 5. 今日汇总与批准(A2 闸)

**jobsync「今日汇总」页**(P2 只读,P3 加按钮):

- "今日" = 当日新入库 + 昨日未处理遗留;
- 分组:推荐(≥4.0)/ 普通(3.0–3.9),分数降序;
- 每行:评分、职位、公司、城市、薪资、双休状态(✓ / ? / ✗)、一句话摘要;点名展开完整评估报告 + JD 链接;
- <3.0 不显示,看板可查;顶部显示「今日收取 N 个」让用户对扫描量有感。

**Claude Code 文本版**:同一数据源(MCP 拉取),对话形式汇报。

**批准**:

- 双入口:Claude Code 对话(P2 先行)/ jobsync UI 勾选按钮(P3 补);
- 批准前 Claude Code **复述清单**,用户答"确认"才落 `JobStatus = 已批准`;
- 只认当日汇总内的职位,防误批陈年职位。

## 6. 写侧投递(晚间,人在场)

1. 用户批准 → `set_status` 落"已批准";
2. AI agent 经 **OpenCLI Browser Bridge 扩展**驱动真实浏览器(CDP 通道已证伪,ADR-0002),逐个职位:**选中预存的一版常用语 → 一键发送**;不现场打字;
3. 人化频率:≤20 条/天、间隔 30s–3min、仅 9:00–21:00;
4. 验证码/滑块 → 停下交用户手动;风控弹窗 → 当天熔断停投;
5. 发完回写 `greetingSentAt`。

**确认问句不进招呼语**(ADR-0001 修订):双休/薪资确认在「HR 回复 → 交换简历」后由用户本人在手机 App 发出;系统只标记缺失信息、捕获回复、回填字段。

## 7. onboarding(首次运行,约 10 分钟)

Claude Code 引导:① 依赖检查(Node 22 / Chrome / apps/web 装好 / opencli + Browser Bridge 扩展连通,`opencli doctor`)→ ② 复制 `profile/candidate.example.yaml` → `candidate.yaml` 对话式填写(`/setup-profile`)→ ③ `.env` 填 `SCORING_API_KEY` → ④ 确认日常浏览器已登录 Boss(未登录则用户手动登录一次)→ ⑤ dry-run:用户打开一个 Boss 搜索结果页,系统抽取 1 页验证解析器 → ⑥ 注册任务计划程序(评分/备份)→ ⑦ 配 `.mcp.json` 验证 `list_jobs`。全过打印"系统就绪"。

## 8. 主仓库工程约定

- TypeScript / Node 22 LTS / npm / Vitest / ESLint+Prettier;单包结构,不上 monorepo 工具;
- 目录:

```
apps/web/      # jobsync 拷入(含 UPSTREAM.md)
src/
├── daemon/    # 常驻进程入口、定时器(评分/备份,不碰浏览器)
├── boss/      # Boss provider(陪同式抽取、JD 解析、消息捕获;经扩展读 DOM)
├── scoring/   # LLM 评分(OpenAI 兼容客户端)
├── jobsync/   # jobsync MCP 客户端封装
├── lib/       # career-ops 搬来的读侧模式
└── prompts/   # scoring.md / greeting.md / preflight.md
profile/       # candidate.yaml(gitignored)+ candidate.example.yaml
data/          # daemon.pid / daemon.log
backups/       # dev.db 每日备份,留 14 份
resumes/       # 定制简历(P4)
tests/         # 镜像 src/
```

## 9. 各阶段确认边界

- **P0**:apps/web 拷入跑通 + 5 列迁移 + 5 个 MCP tool + MCP 连通 + 主仓库骨架(详见 PRD §7);
- **P4 简历生成**:暂不展开设计,用户提出时再做;已确认方向 = 晚间按需生成(Claude Code 本人,非白天便宜模型)、产出 PDF 存 `resumes/`、手动拷到手机;
- **飞书/ACP**:用户个人连接 Claude Code 的用法,**不在本仓库范围**。

## 10. 本版本冻结的默认值(可调,改 YAML 即可)

评分 12:30/17:30(收取为陪同式,无时刻表)· 发送 ≤20/天、间隔 30s–3min、9:00–21:00 · 阈值 3.0/4.0 · 权重 30/25/15/25/5 · 备份留 14 份 · 汇总 18:30 前就绪。
