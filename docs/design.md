# 技术设计 — job-for-claude(AJS)

> 状态:v1 · 2026-07-24(2026-07-24 设计访谈(grill)的全部结论)
> 性质:技术设计文档,承接 PRD(做什么)与 ADR(关键权衡)之间的细节层。术语见 `../CONTEXT.md`。

---

## 1. 运行时拓扑

全部跑在用户 Windows PC,单仓库、零容器、零云依赖:

```
            用户(晚间,对话 / 手机经 ACP 桥接,ACP 属个人用法,不在本仓库)
                │
                ▼
        ┌───────────────┐   chrome-devtools MCP    ┌──────────────┐
        │  Claude Code  │ ───────────────────────► │ 专用 Chrome  │
        │  (大脑/入口)   │   写侧:发招呼语(一键常用语) │ profile      │
        └──┬─────────┬──┘                          │ (Boss 登录态) │
     MCP   │         │ 状态读写                       ▲
           ▼         ▼                              │ launchPersistentContext
  ┌──────────────┐  ┌──────────────────────┐       │
  │ daemon        │  │ apps/web (jobsync)   │───────┘
  │ 扫描/评分/消息 │  │ MCP server + 看板     │  daemon 读侧复用同一 profile
  └──────────────┘  │ dev.db = 唯一真相     │
                    └──────────────────────┘
```

**分工铁律**:

| 侧 | 驱动者 | 何时运行 | 人在场? |
|---|---|---|---|
| 读侧(扫描 / JD 抽取 / 消息捕获) | daemon 脚本(Playwright) | 白天定时 | 否 |
| 评分 | daemon 调 LLM API | 白天,扫描后 | 否 |
| 写侧(发招呼语) | Claude Code + chrome-devtools MCP | 晚间批准后 | **是** |
| HR 对话(问双休/发简历/聊天) | 用户本人,手机 Boss App | 随时 | 是 |

登录态:读写两侧共享**专用 Chrome profile 目录**(非日常浏览器),QR 扫码一次持久化。

## 2. daemon(读侧常驻进程)

单 Node 进程,由 Windows 任务计划程序在登录时启动;`/start-job-hunt` / `/stop-job-hunt`(Claude Code 命令)管理启停;PID 写 `data/daemon.pid`,日志写 `data/daemon.log`。重复启动返回"已在运行"。

**职责**(严格只读 Boss):
1. 定时扫描 → JD 抽取 → 写 jobsync;
2. 调 LLM 评分 → 写回 jobsync;
3. 扫描时顺带捕获 HR 消息(不单独加轮询)→ 原文存 Note、回填 `hrReplyAt`、LLM 抽取双休/薪资答案回填(低置信度转人工标记);
4. 每天最后一次扫描后备份 `dev.db` → `backups/dev-YYYYMMDD.db`,保留 14 份。

**时刻表**(YAML 可配):

| 触发 | 默认 | 说明 |
|---|---|---|
| 开机补扫 | Windows 登录时 | 补昨夜;「错过补跑」由任务计划程序负责 |
| 白天扫描 1 | 12:30 | 混在午休真人流量中 |
| 白天扫描 2 | 17:30 | 下班前;18:30 前汇总就绪 |

**异常处理**:不主动外发。错误写日志 + jobsync Note;阻断性问题(登录态失效、连续两次扫描失败)在今日汇总页顶部显示横幅;晚间 Claude Code 口述报告。登录态失效 → 用户手动 `npm run boss:login` 重扫 QR,daemon 不自动弹窗。

## 3. 搜索策略

- **关键词 × 城市**组合轮询:画像 `targetRoles` × `preferredCities` 逐个搜,不用超大组合词;
- Boss 原生过滤器只用**薪资下限 + 经验年限**;学历/公司规模**不过滤**,交评分(避免误杀);
- 按"最新"排序,每组合前 3 页;
- **jobId 去重**(URL 提取),已入库跳过;
- 组合间随机停 30s–2min,偶尔点开详情停留;单次扫描 ≤20 分钟;遇滑块/验证 → 本次中止并记录。

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
- <3.0 不显示,看板可查。

**Claude Code 文本版**:同一数据源(MCP 拉取),对话形式汇报。

**批准**:

- 双入口:Claude Code 对话(P2 先行)/ jobsync UI 勾选按钮(P3 补);
- 批准前 Claude Code **复述清单**,用户答"确认"才落 `JobStatus = 已批准`;
- 只认当日汇总内的职位,防误批陈年职位。

## 6. 写侧投递(晚间,人在场)

1. 用户批准 → `set_status` 落"已批准";
2. Claude Code 经 chrome-devtools MCP 打开 Boss(专用 profile),逐个职位:**选中预存的一版常用语 → 一键发送**;不现场打字;
3. 人化频率:≤20 条/天、间隔 30s–3min、仅 9:00–21:00;
4. 验证码/滑块 → 停下交用户手动;风控弹窗 → 当天熔断停投;
5. 发完回写 `greetingSentAt`。

**确认问句不进招呼语**(ADR-0001 修订):双休/薪资确认在「HR 回复 → 交换简历」后由用户本人在手机 App 发出;系统只标记缺失信息、捕获回复、回填字段。

## 7. onboarding(首次运行,约 10 分钟)

Claude Code 引导:① 依赖检查(Node 22 / Chrome / apps/web 装好)→ ② 复制 `profile/candidate.example.yaml` → `candidate.yaml` 对话式填写 → ③ `.env` 填 `SCORING_API_KEY` → ④ `npm run boss:login` 扫码登录(独立手动命令)→ ⑤ dry-run 扫描 1 关键词 1 页验证选择器 → ⑥ 注册任务计划程序 → ⑦ 配 `.mcp.json` 验证 `list_jobs`。全过打印"系统就绪"。

## 8. 主仓库工程约定

- TypeScript / Node 22 LTS / npm / Vitest / ESLint+Prettier;单包结构,不上 monorepo 工具;
- 目录:

```
apps/web/      # jobsync 拷入(含 UPSTREAM.md)
src/
├── daemon/    # 常驻进程入口、定时器
├── boss/      # Boss provider(扫描、JD 抽取、消息捕获)
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

扫描 12:30/17:30 · 发送 ≤20/天、间隔 30s–3min、9:00–21:00 · 阈值 3.0/4.0 · 权重 30/25/15/25/5 · 备份留 14 份 · 汇总 18:30 前就绪。
