import { handleSetStatus } from "@/lib/mcp/tools/setStatus";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    jobStatus: { findFirst: vi.fn() },
    job: { update: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe("handleSetStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.jobStatus.findFirst as any).mockResolvedValue({
      id: "status-1",
      label: "已批准",
      value: "approved",
    });
    (prisma.job.update as any).mockResolvedValue({ id: "job-1" });
  });

  it("sets the job's statusId from an existing status name", async () => {
    const result = await handleSetStatus(
      { jobId: "job-1", status: "已批准" },
      "user-1",
      "my-token",
    );

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: { statusId: "status-1" },
    });
    expect(result.content[0].text).toContain("job-1");
    expect(result.content[0].text).toContain("已批准");
  });

  it("also resolves a status by its value (e.g. 'approved')", async () => {
    await handleSetStatus(
      { jobId: "job-1", status: "approved" },
      "user-1",
      "my-token",
    );

    expect(prisma.jobStatus.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ label: "approved" }, { value: "approved" }] },
    });
    expect(prisma.job.update).toHaveBeenCalled();
  });

  it("returns an error and writes nothing when the status name does not exist", async () => {
    (prisma.jobStatus.findFirst as any).mockResolvedValue(null);

    const result = await handleSetStatus(
      { jobId: "job-1", status: "不存在的状态" },
      "user-2",
      "my-token",
    );

    expect(result.content[0].text).toContain("不存在的状态");
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it("returns a not-found message when the job does not exist or is not owned (P2025)", async () => {
    (prisma.job.update as any).mockRejectedValue({ code: "P2025" });

    const result = await handleSetStatus(
      { jobId: "someone-elses-job", status: "已批准" },
      "user-3",
      "my-token",
    );

    expect(result.content[0].text).toContain("Job not found");
  });

  it("returns a rate-limit message and never looks anything up when the limit is exceeded", async () => {
    (checkMcpRateLimit as any).mockReturnValueOnce({ allowed: false, resetIn: 60000 });

    const result = await handleSetStatus(
      { jobId: "job-1", status: "已批准" },
      "user-4",
      "my-token",
    );

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.jobStatus.findFirst).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
