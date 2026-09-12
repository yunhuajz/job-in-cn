import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateJobsForUser } from "@/lib/ai/evaluate";
import prisma from "@/lib/db";
import { getDefaultResumeForUser } from "@/lib/jobs/getDefaultResumeForUser";

vi.mock("@/lib/db", () => ({
  default: {
    userSettings: {
      findUnique: vi.fn(),
    },
    job: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/jobs/getDefaultResumeForUser", () => ({
  getDefaultResumeForUser: vi.fn(),
}));

vi.mock("@/lib/jobs/extractResumeFileText", () => ({
  extractResumeFileText: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
  getModel: vi.fn(),
}));

describe("evaluateJobsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当未配置评分模型时抛出错误", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
      settings: JSON.stringify({ aiProfiles: [], ai: { model: "" } }),
    } as any);

    await expect(
      evaluateJobsForUser({ ids: ["job-1"] }, "user-1"),
    ).rejects.toThrow("请先在“AI 设置”中选择评分模型");
  });

  it("当未设置默认简历时抛出错误", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
      settings: JSON.stringify({ aiProfiles: [{ isActive: true, model: "gpt-4o" }] }),
    } as any);
    vi.mocked(getDefaultResumeForUser).mockResolvedValueOnce(null);

    await expect(
      evaluateJobsForUser({ ids: ["job-1"] }, "user-1"),
    ).rejects.toThrow("请先在个人资料中设置默认简历");
  });

  it("当简历有效字数少于 200 字时抛出提示错误", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
      settings: JSON.stringify({ aiProfiles: [{ isActive: true, model: "gpt-4o" }] }),
    } as any);
    vi.mocked(getDefaultResumeForUser).mockResolvedValueOnce({
      id: "resume-1",
      title: "我的简版简历",
      content: "短内容",
    } as any);

    await expect(
      evaluateJobsForUser({ ids: ["job-1"] }, "user-1"),
    ).rejects.toThrow("有效内容过少");
  });

  it("当模型返回有效匹配报告时正确更新数据库并返回成功数", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
      settings: JSON.stringify({ aiProfiles: [{ isActive: true, model: "gpt-4o" }] }),
    } as any);

    const longResumeText = "我是一名前端高级开发工程师，拥有超过八年的丰富经验。精通 TypeScript、React、Next.js 以及 Tailwind CSS，曾主导过多个大型中后台与高并发求职平台的架构设计与性能优化，具备极强的系统抽象能力。".repeat(2);
    vi.mocked(getDefaultResumeForUser).mockResolvedValueOnce({
      id: "resume-1",
      title: "资深工程师简历",
      ResumeSections: [
        {
          sectionType: "summary" as any,
          sectionTitle: "个人总结",
          summary: { content: longResumeText },
        },
      ],
    } as any);

    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        description: "负责平台前端架构设计，需要熟悉 React/Next.js",
        salaryRange: "25-35K",
        JobTitle: { label: "前端技术专家" },
        Company: { label: "创新科技" },
        Location: { label: "北京" },
      } as any,
    ]);

    const mockGenerate = vi.fn().mockResolvedValueOnce({
      text: "SCORES: match=92 recommendation=strong\n\n综合评估：该候选人经历与职位高度匹配。",
    });

    const result = await evaluateJobsForUser(
      {
        ids: ["job-1"],
        generateFn: mockGenerate as any,
      },
      "user-1",
    );

    expect(result.scored).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(0);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: {
        matchScore: 92,
        evaluationReport: "综合评估：该候选人经历与职位高度匹配。",
        matchData: expect.stringContaining('"matchScore":92'),
      },
    });
  });

  it("当单个职位评估失败时记录到 failures 且不阻断其它职位", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce({
      settings: JSON.stringify({ aiProfiles: [{ isActive: true, model: "gpt-4o" }] }),
    } as any);

    const longResumeText = "我是一名前端高级开发工程师，拥有超过八年的丰富经验。精通 TypeScript、React、Next.js 以及 Tailwind CSS，曾主导过多个大型中后台与高并发求职平台的架构设计与性能优化，具备极强的系统抽象能力。".repeat(2);
    vi.mocked(getDefaultResumeForUser).mockResolvedValueOnce({
      id: "resume-1",
      title: "资深工程师简历",
      ResumeSections: [
        {
          sectionType: "summary" as any,
          sectionTitle: "个人总结",
          summary: { content: longResumeText },
        },
      ],
    } as any);

    vi.mocked(prisma.job.findMany).mockResolvedValueOnce([
      {
        id: "job-1",
        description: "岗位 1",
        salaryRange: "20-30K",
        JobTitle: { label: "异常岗位" },
        Company: { label: "公司 A" },
        Location: { label: "北京" },
      } as any,
      {
        id: "job-2",
        description: "岗位 2",
        salaryRange: "20-30K",
        JobTitle: { label: "正常岗位" },
        Company: { label: "公司 B" },
        Location: { label: "北京" },
      } as any,
    ]);

    const mockGenerate = vi
      .fn()
      .mockResolvedValueOnce({ text: "模型胡言乱语无评分格式" })
      .mockResolvedValueOnce({ text: "SCORES: match=80 recommendation=good\n\n还不错" });

    const result = await evaluateJobsForUser(
      {
        ids: ["job-1", "job-2"],
        generateFn: mockGenerate as any,
      },
      "user-1",
    );

    expect(result.scored).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures[0]).toContain("异常岗位：模型没有返回可识别的评分");
    expect(prisma.job.update).toHaveBeenCalledTimes(1);
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-2", userId: "user-1" } }),
    );
  });
});
