import { handleGetJob } from "@/lib/mcp/tools/getJob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: { findFirst: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const dbJob = {
  id: "job-1",
  description: "<p>负责 AI Agent 开发</p>\n<p>要求 Python 基础</p>",
  salaryRange: "25-35K",
  jobUrl: "https://www.zhipin.com/job_detail/abc.html",
  matchScore: null,
  weekendRestStatus: "none",
  JobTitle: { label: "AI Agent 工程师" },
  Company: { label: "考试星" },
  Location: { label: "北京" },
  Status: { label: "Draft" },
  JobSource: { label: "Boss直聘" },
};

describe("handleGetJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.findFirst as any).mockResolvedValue(dbJob);
  });

  it("returns the full job with plain-text description", async () => {
    const result = await handleGetJob({ jobId: "job-1" }, "user-1", "tok");
    const row = JSON.parse(result.content[0].text);
    expect(row).toMatchObject({
      id: "job-1",
      jobTitle: "AI Agent 工程师",
      company: "考试星",
      city: "北京",
      salary: "25-35K",
      source: "Boss直聘",
      status: "Draft",
      matchScore: null,
      jobUrl: "https://www.zhipin.com/job_detail/abc.html",
    });
    expect(row.jobDescription).toContain("负责 AI Agent 开发");
    expect(row.jobDescription).not.toContain("<p>");
  });

  it("scopes the query to the token's user", async () => {
    await handleGetJob({ jobId: "job-1" }, "user-1", "tok");
    expect(prisma.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "job-1", userId: "user-1" } }),
    );
  });

  it("reports not-found jobs", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);
    const result = await handleGetJob({ jobId: "nope" }, "user-1", "tok");
    expect(result.content[0].text).toMatch(/not found/i);
  });
});
