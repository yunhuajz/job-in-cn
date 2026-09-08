import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/local/jobs/route";

vi.mock("@/lib/db", () => ({ default: {
  user: { findMany: vi.fn(async () => [{ id: "owner", name: "本地", email: "local@test.test" }]) },
  job: { findMany: vi.fn(async () => [
    { id: "low", salaryRange: "5-6K", description: "双休", weekendRestStatus: "none", matchScore: 40, createdAt: new Date("2026-09-01T09:00:00.000Z"), JobTitle: { label: "开发" }, Company: { label: "甲" }, Location: { label: "天津" } },
    { id: "yes", salaryRange: "8-12K", description: "双休", weekendRestStatus: "none", matchScore: 80, createdAt: new Date("2026-09-03T09:00:00.000Z"), JobTitle: { label: "开发" }, Company: { label: "乙" }, Location: { label: "天津" } },
    { id: "unknown", salaryRange: "面议", description: "待确认", weekendRestStatus: "none", matchScore: null, createdAt: new Date("2026-09-02T09:00:00.000Z"), JobTitle: { label: "开发" }, Company: { label: "丙" }, Location: { label: "天津" } },
  ]) },
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
