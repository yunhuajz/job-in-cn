import { handleAddHrReply } from "@/lib/mcp/tools/addHrReply";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: { findFirst: vi.fn(), update: vi.fn() },
    note: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe("handleAddHrReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.findFirst as any).mockResolvedValue({
      id: "job-1",
      hrReplyAt: null,
    });
    (prisma.note.create as any).mockResolvedValue({ id: "note-1" });
    (prisma.job.update as any).mockResolvedValue({ id: "job-1" });
  });

  it("creates a note and backfills hrReplyAt when unset", async () => {
    const result = await handleAddHrReply(
      { jobId: "job-1", content: "HR: 双休,薪资 15K" } as any,
      "user-1",
      "tok",
    );
    expect(prisma.note.create).toHaveBeenCalledWith({
      data: { jobId: "job-1", userId: "user-1", content: "HR: 双休,薪资 15K" },
    });
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { hrReplyAt: expect.any(Date) },
    });
    expect(result.content[0].text).toMatch(/backfilled/);
  });

  it("does not overwrite an existing hrReplyAt", async () => {
    const existing = new Date("2026-07-25T10:00:00Z");
    (prisma.job.findFirst as any).mockResolvedValue({
      id: "job-1",
      hrReplyAt: existing,
    });
    const result = await handleAddHrReply(
      { jobId: "job-1", content: "HR: 又回复了" } as any,
      "user-1",
      "tok",
    );
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { hrReplyAt: existing },
    });
    expect(result.content[0].text).toMatch(/already set/);
  });

  it("reports not-found jobs", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);
    const result = await handleAddHrReply(
      { jobId: "nope", content: "x" } as any,
      "user-1",
      "tok",
    );
    expect(result.content[0].text).toMatch(/not found/i);
    expect(prisma.note.create).not.toHaveBeenCalled();
  });
});
