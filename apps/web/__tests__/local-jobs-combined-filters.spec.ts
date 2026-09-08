import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/local/jobs/route";

vi.mock("@/lib/db", () => ({ default: {
  user: { findMany: vi.fn(async () => [{ id: "owner", name: "本地", email: "local@test.test" }]) },
  job: { findMany: vi.fn(async () => [
    {
      id: "bj-yes-high",
      salaryRange: "25-35K",
      description: "双休，朝九晚六",
      weekendRestStatus: "none",
      matchScore: 85,
      createdAt: new Date("2026-09-03T09:00:00.000Z"),
      JobTitle: { label: "大模型工程师" },
      Company: { label: "字节跳动" },
      Location: { label: "北京·海淀区" },
      JobSource: { label: "Boss直聘" },
      Status: { value: "draft", label: "草稿" },
    },
    {
      id: "sh-yes-med",
      salaryRange: "15-25K",
      description: "做五休二双休",
      weekendRestStatus: "none",
      matchScore: 72,
      createdAt: new Date("2026-09-02T09:00:00.000Z"),
      JobTitle: { label: "前端架构师" },
      Company: { label: "阿里巴巴" },
      Location: { label: "上海·浦东" },
      JobSource: { label: "Boss直聘" },
      Status: { value: "applied", label: "已沟通" },
    },
    {
      id: "bj-unknown-high",
      salaryRange: "20-30K",
      description: "弹性工作",
      weekendRestStatus: "none",
      matchScore: 82,
      createdAt: new Date("2026-09-01T09:00:00.000Z"),
      JobTitle: { label: "AI应用开发" },
      Company: { label: "小红书" },
      Location: { label: "北京·朝阳区" },
      JobSource: { label: "智联招聘" },
      Status: { value: "draft", label: "草稿" },
    },
    {
      id: "gz-no-low",
      salaryRange: "10-12K",
      description: "单休，项目繁忙",
      weekendRestStatus: "none",
      matchScore: 40,
      createdAt: new Date("2026-09-01T09:00:00.000Z"),
      JobTitle: { label: "运维开发" },
      Company: { label: "测试科技" },
      Location: { label: "广州·天河" },
      JobSource: { label: "51job" },
      Status: { value: "draft", label: "草稿" },
    },
  ]) },
} }));

afterEach(() => vi.unstubAllEnvs());

it("支持严格双休筛选：weekend=yes 仅返回明确双休岗位，不泄露未知岗位", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?weekend=yes"));
  expect(response.status).toBe(200);
  const data = await response.json();
  const ids = data.jobs.map((j: any) => j.id);
  expect(ids).toContain("bj-yes-high");
  expect(ids).toContain("sh-yes-med");
  expect(ids).not.toContain("bj-unknown-high");
  expect(ids).not.toContain("gz-no-low");
});

it("支持评分档次筛选：score=4_plus 仅返回 80 分以上的高分岗位", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?score=4_plus"));
  expect(response.status).toBe(200);
  const data = await response.json();
  const ids = data.jobs.map((j: any) => j.id);
  expect(ids).toEqual(["bj-yes-high", "bj-unknown-high"]);
});

it("支持地点多城市组合匹配：city=北京 上海 支持空格分词任一包含", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?city=%E5%8C%97%E4%BA%AC%20%E4%B8%8A%E6%B5%B7"));
  expect(response.status).toBe(200);
  const data = await response.json();
  const ids = data.jobs.map((j: any) => j.id);
  expect(ids).toContain("bj-yes-high");
  expect(ids).toContain("sh-yes-med");
  expect(ids).toContain("bj-unknown-high");
  expect(ids).not.toContain("gz-no-low");
});

it("四重组合筛选同时生效：地点(北京) + 双休(yes) + 评分(4_plus) + 进度(unapplied)", async () => {
  vi.stubEnv("JBCN_LOCAL", "1");
  const response = await GET(new Request("http://127.0.0.1:3737/api/local/jobs?city=%E5%8C%97%E4%BA%AC&weekend=yes&score=4_plus&progress=unapplied"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.total).toBe(1);
  expect(data.jobs[0].id).toBe("bj-yes-high");
});
