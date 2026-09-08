// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createAjsTestDb } from "./helpers/ajsTestDb";
import { CrawlRun } from "../../../src/crawler/run";
import { crawlerConfigSchema } from "../../../src/crawler/config";

let database: ReturnType<typeof createAjsTestDb>;
beforeAll(async () => {
  database = createAjsTestDb("local-crawl");
  vi.doMock("@/lib/db", () => ({ default: database.prisma }));
  vi.stubEnv("JBCN_LOCAL", "1");
  vi.stubEnv("ENCRYPTION_KEY", "local-test-encryption-key");
  await database.prisma.user.create({ data: { id: "local-owner", email: "local@test.invalid", name: "本地测试", password: "unused" } });
  await database.prisma.jobStatus.createMany({ data: [
    { label: "未投递", value: "draft" },
    { label: "投递过", value: "applied" },
    { label: "深度推进中", value: "interview" },
    { label: "收到 offer", value: "offer" },
  ] });
}, 30_000);
afterAll(async () => { vi.unstubAllEnvs(); await database?.cleanup(); });

it("采集结果进入原账号的岗位列表，同一 URL 重采不重复入库", async () => {
  const { createJobFromNames } = await import("@/lib/jobs/createJobFromNames");
  const { GET } = await import("@/app/api/local/jobs/route");
  const job = { company: "测试公司", jobTitle: "开发工程师", salaryRange: "8-12K", jobDescription: "周末双休", location: "天津", source: "Boss直聘", jobUrl: "https://www.zhipin.com/job_detail/test.html", tags: [] };
  const run = new CrawlRun(async function* () { yield job; yield job; });
  run.start(crawlerConfigSchema.parse({ keywords: ["开发"], cities: ["天津"] }), (input) => createJobFromNames(input, "local-owner"));
  await run.finished();
  expect(run.snapshot()).toMatchObject({ status: "completed", added: 1, duplicates: 1 });
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs"));
  const body = await response.json();
  expect(body.total).toBe(1);
  expect(body.jobs[0]).toMatchObject({ title: "开发工程师", company: "测试公司", weekend: "yes" });
});

it("同一岗位重复采集时保留一个主体岗位，并可按每次采集日期查到", async () => {
  const { recordCrawledJob } = await import("@/lib/local/jobs");
  const { GET } = await import("@/app/api/local/jobs/route");
  const job = { company: "测试公司", jobTitle: "数据工程师", salaryRange: "10-15K", jobDescription: "双休", location: "天津", source: "前程无忧51job", jobUrl: "https://example.test/jobs/data", tags: [] };
  await recordCrawledJob(job, "local-owner", new Date("2026-09-01T08:00:00.000Z"));
  await recordCrawledJob(job, "local-owner", new Date("2026-09-03T08:00:00.000Z"));

  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?from=2026-09-03&to=2026-09-03"));
  const body = await response.json();
  expect(body.total).toBe(1);
  expect(body.jobs[0]).toMatchObject({
    title: "数据工程师",
    firstCollectedAt: "2026-09-01T08:00:00.000Z",
    collectedAt: "2026-09-03T08:00:00.000Z",
  });
});

it("岗位页可批量标记求职进度，并按进度筛选", async () => {
  const { recordCrawledJob } = await import("@/lib/local/jobs");
  const { GET, PATCH } = await import("@/app/api/local/jobs/route");
  const created = await recordCrawledJob({ company: "测试公司", jobTitle: "算法工程师", salaryRange: "15-20K", jobDescription: "双休", location: "天津", source: "智联招聘", jobUrl: "https://example.test/jobs/algorithm", tags: [] }, "local-owner");

  const response = await PATCH(new Request("http://127.0.0.1:3737/api/local/jobs", {
    method: "PATCH", body: JSON.stringify({ ids: [created.jobId], progress: "applied" }),
  }));
  expect(await response.json()).toMatchObject({ updated: 1 });

  const list = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?progress=applied"));
  const body = await list.json();
  expect(body.jobs).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.jobId, progress: "applied" })]));
});

it("批量自动投递没有明确确认时拒绝执行", async () => {
  const { recordCrawledJob } = await import("@/lib/local/jobs");
  const { POST } = await import("@/app/api/local/apply/route");
  const created = await recordCrawledJob({ company: "测试公司", jobTitle: "后端工程师", salaryRange: "15-20K", jobDescription: "双休", location: "天津", source: "Boss直聘", jobUrl: "https://www.zhipin.com/job_detail/confirm.html", tags: [] }, "local-owner");
  const response = await POST(new Request("http://127.0.0.1:3737/api/local/apply", {
    method: "POST", body: JSON.stringify({ ids: [created.jobId], confirmed: false }),
  }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("确认") });
});

it("LLM 评分未选择模型时提示先完成 AI 设置", async () => {
  const { recordCrawledJob } = await import("@/lib/local/jobs");
  const { POST } = await import("@/app/api/local/score/route");
  const created = await recordCrawledJob({ company: "测试公司", jobTitle: "产品经理", salaryRange: "15-20K", jobDescription: "负责产品规划和数据分析", location: "天津", source: "Boss直聘", jobUrl: "https://example.test/jobs/score", tags: [] }, "local-owner");
  const response = await POST(new Request("http://127.0.0.1:3737/api/local/score", {
    method: "POST", body: JSON.stringify({ ids: [created.jobId] }),
  }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("AI 设置") });
});

it("AI 设置可保存 Anthropic 兼容格式、Base URL、手填模型和密钥", async () => {
  const { GET, POST } = await import("@/app/api/local/ai-settings/route");
  const saved = await POST(new Request("http://127.0.0.1:3737/api/local/ai-settings", { method: "POST", body: JSON.stringify({ protocol: "anthropic", baseURL: "https://api.deepseek.com/anthropic", model: "deepseek-v4-flash", apiKey: "test-deepseek-key" }) }));
  expect(saved.status).toBe(200);
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/ai-settings"));
  expect(await response.json()).toMatchObject({ protocol: "anthropic", baseURL: "https://api.deepseek.com/anthropic", model: "deepseek-v4-flash", hasKey: true, last4: "-key" });
});

it("AI 设置可从兼容接口获取模型列表", async () => {
  const originalFetch = globalThis.fetch;
  const request = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "deepseek-v4-flash" }, { id: "deepseek-v4-pro" }] })));
  vi.stubGlobal("fetch", request);
  try {
    const { PUT } = await import("@/app/api/local/ai-settings/route");
    const response = await PUT(new Request("http://127.0.0.1:3737/api/local/ai-settings", { method: "PUT", body: JSON.stringify({ protocol: "anthropic", baseURL: "https://api.deepseek.com/anthropic", apiKey: "unsaved-key" }) }));
    expect(await response.json()).toEqual({ models: ["deepseek-v4-flash", "deepseek-v4-pro"] });
    expect(request).toHaveBeenCalledWith(new URL("https://api.deepseek.com/models"), expect.objectContaining({ headers: expect.any(Object) }));
  } finally { vi.stubGlobal("fetch", originalFetch); }
});
