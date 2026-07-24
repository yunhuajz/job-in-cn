import { handleListJobs } from "@/lib/mcp/tools/listJobs";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    jobStatus: { findFirst: vi.fn() },
    job: { findMany: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const dbJob = {
  id: "job-1",
  matchScore: 84,
  salaryRange: "25k-35k",
  weekendRestStatus: "pending",
  JobTitle: { label: "前端工程师" },
  Company: { label: "阿里" },
  Location: { label: "杭州" },
  Status: { label: "待确认" },
};

describe("handleListJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.findMany as any).mockResolvedValue([dbJob]);
  });

  it("lists the user's jobs newest-first with slim fields, default limit 20", async () => {
    const result = await handleListJobs({} as any, "user-1", "my-token");

    expect(prisma.job.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        matchScore: true,
        salaryRange: true,
        weekendRestStatus: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Location: { select: { label: true } },
        Status: { select: { label: true } },
      },
    });

    const jobs = JSON.parse(result.content[0].text);
    expect(jobs).toEqual([
      {
        id: "job-1",
        jobTitle: "前端工程师",
        company: "阿里",
        city: "杭州",
        salary: "25k-35k",
        matchScore: 84,
        weekendRestStatus: "pending",
        status: "待确认",
      },
    ]);
  });

  it("filters by status name, minMatchScore, and createdAt since", async () => {
    (prisma.jobStatus.findFirst as any).mockResolvedValue({
      id: "status-1",
      label: "已批准",
      value: "approved",
    });
    const since = new Date("2026-07-24T00:00:00+08:00");

    await handleListJobs(
      { status: "已批准", minMatchScore: 60, since, limit: 5 },
      "user-2",
      "my-token",
    );

    expect(prisma.jobStatus.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ label: "已批准" }, { value: "已批准" }] },
    });
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-2",
          statusId: "status-1",
          matchScore: { gte: 60 },
          createdAt: { gte: since },
        },
        take: 5,
      }),
    );
  });

  it("returns an error and queries nothing when the status name does not exist", async () => {
    (prisma.jobStatus.findFirst as any).mockResolvedValue(null);

    const result = await handleListJobs(
      { status: "不存在的状态" } as any,
      "user-3",
      "my-token",
    );

    expect(result.content[0].text).toContain("不存在的状态");
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });

  it("maps a null Location to city: null", async () => {
    (prisma.job.findMany as any).mockResolvedValue([
      { ...dbJob, Location: null },
    ]);

    const result = await handleListJobs({} as any, "user-4", "my-token");

    expect(JSON.parse(result.content[0].text)[0].city).toBeNull();
  });

  it("returns a rate-limit message and never queries when the limit is exceeded", async () => {
    (checkMcpRateLimit as any).mockReturnValueOnce({ allowed: false, resetIn: 60000 });

    const result = await handleListJobs({} as any, "user-5", "my-token");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });
});
