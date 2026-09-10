import { afterEach, expect, it, vi } from "vitest";
import { DELETE, GET } from "@/app/api/local/jobs/route";

vi.mock("@/lib/db", () => ({ default: {
  user: { findMany: vi.fn(async () => [{ id: "owner", name: "本地", email: "local@test.test" }]) },
  job: { findMany: vi.fn(async () => [
    { id: "low", salaryRange: "5-6K", description: "双休", weekendRestStatus: "none", matchScore: 40, createdAt: new Date("2026-09-01T09:00:00.000Z"), JobTitle: { label: "开发" }, Company: { label: "甲科技" }, Location: { label: "天津" }, Status: { value: "draft", label: "未投递" } },
    { id: "yes", salaryRange: "8-12K", description: "双休", weekendRestStatus: "none", matchScore: 80, evaluationReport: "## 结论\n技能匹配，但商业项目经验不足。\n\n## 优势\n熟悉 TypeScript。", matchData: "{}", createdAt: new Date("2026-09-03T09:00:00.000Z"), JobTitle: { label: "开发" }, Company: { label: "乙网络" }, Location: { label: "天津" }, Status: { value: "interview", label: "面试中" } },
    { id: "unknown", salaryRange: "面议", description: "待确认", weekendRestStatus: "none", matchScore: null, createdAt: new Date("2026-09-02T09:00:00.000Z"), JobTitle: { label: "开发" }, Company: { label: "丙咨询" }, Location: { label: "天津" }, Status: { value: "applied", label: "已投递" } },
  ]), updateMany: vi.fn(async () => ({ count: 2 })) },
} }));
afterEach(() => vi.unstubAllEnvs());

it("岗位页在分页前应用薪资双休筛选，并保留原有岗位详情链接", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?salaryMin=8000&weekend=yes&keepUnknown=false"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.total).toBe(1);
  expect(data.jobs[0]).toMatchObject({ id: "yes", weekend: "yes" });
});

it("岗位页可按评分和采集日期筛选，并在分页前按评分排序", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?scoreMin=3&from=2026-09-02&to=2026-09-03&sort=score_desc"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.jobs.map((job: { id: string }) => job.id)).toEqual(["yes"]);
  expect(data.jobs[0]).toMatchObject({ score: 80, collectedAt: "2026-09-03T09:00:00.000Z" });
});

it("岗位页可单独筛选未评分岗位", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?score=unscored"));
  const data = await response.json();
  expect(data.jobs.map((job: { id: string }) => job.id)).toEqual(["unknown"]);
});

it("岗位页可按月薪和岗位名称排序，无法换算的薪资排在最后", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const bySalary = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?sort=salary_desc"));
  expect((await bySalary.json()).jobs.map((job: { id: string }) => job.id)).toEqual(["yes", "low", "unknown"]);
  const byTitle = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?sort=title_asc"));
  expect((await byTitle.json()).jobs).toHaveLength(3);
});

it("岗位页可用一个或多个公司关键词搜索，任意关键词匹配即可", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?company=甲,丙"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.jobs.map((job: { company: string }) => job.company)).toEqual(["丙咨询", "甲科技"]);
});

it("岗位页可按完整求职状态筛选", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?progress=interview"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.jobs.map((job: { id: string; progress: string }) => [job.id, job.progress])).toEqual([["yes", "interview"]]);
});

it("岗位列表返回可直接展示的评分原因和完整报告", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?score=scored"));
  const data = await response.json();
  const scored = data.jobs.find((job: { id: string }) => job.id === "yes");
  expect(scored).toMatchObject({
    scoreReason: "技能匹配，但商业项目经验不足。",
    evaluationReport: expect.stringContaining("熟悉 TypeScript"),
  });
});

it("删除旧岗位时移入可恢复的回收站", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await DELETE(new Request("http://127.0.0.1:3737/api/local/jobs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] }),
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deleted: 2, recoverable: true });
});
