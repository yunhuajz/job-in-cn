import { handleAddNote } from "@/lib/mcp/tools/addNote";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: { findFirst: vi.fn() },
    note: { create: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe("handleAddNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.findFirst as any).mockResolvedValue({ id: "job-1" });
    (prisma.note.create as any).mockResolvedValue({ id: "note-1" });
  });

  it("creates a Note on an owned job (greeting / HR reply carrier)", async () => {
    const result = await handleAddNote(
      { jobId: "job-1", content: "HR:我们双休,法定节假日正常。" },
      "user-1",
      "my-token",
    );

    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      select: { id: true },
    });
    expect(prisma.note.create).toHaveBeenCalledWith({
      data: {
        jobId: "job-1",
        userId: "user-1",
        content: "HR:我们双休,法定节假日正常。",
      },
    });
    expect(result.content[0].text).toContain("note-1");
    expect(result.content[0].text).toContain("job-1");
  });

  it("returns an error and creates nothing when the job does not exist or is not owned", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);

    const result = await handleAddNote(
      { jobId: "someone-elses-job", content: "note" },
      "user-2",
      "my-token",
    );

    expect(result.content[0].text).toContain("Job not found");
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("surfaces a generic error message on a DB failure", async () => {
    (prisma.note.create as any).mockRejectedValue({ message: "connection reset" });

    const result = await handleAddNote(
      { jobId: "job-1", content: "note" },
      "user-3",
      "my-token",
    );

    expect(result.content[0].text).toContain("Error: connection reset");
  });

  it("returns a rate-limit message and never writes when the limit is exceeded", async () => {
    (checkMcpRateLimit as any).mockReturnValueOnce({ allowed: false, resetIn: 60000 });

    const result = await handleAddNote(
      { jobId: "job-1", content: "note" },
      "user-4",
      "my-token",
    );

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.note.create).not.toHaveBeenCalled();
  });
});
