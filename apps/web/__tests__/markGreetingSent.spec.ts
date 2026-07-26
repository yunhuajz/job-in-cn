import { handleMarkGreetingSent } from "@/lib/mcp/tools/markGreetingSent";
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

describe("handleMarkGreetingSent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.findFirst as any).mockResolvedValue({
      id: "job-1",
      greetingSentAt: null,
      Status: { value: "approved" },
    });
    (prisma.note.create as any).mockResolvedValue({ id: "note-1" });
    (prisma.job.update as any).mockResolvedValue({ id: "job-1" });
  });

  it("backfills greetingSentAt and writes a note for approved jobs", async () => {
    const result = await handleMarkGreetingSent(
      { jobId: "job-1" } as any,
      "user-1",
      "tok",
    );
    expect(prisma.note.create).toHaveBeenCalled();
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { greetingSentAt: expect.any(Date) },
    });
    expect(result.content[0].text).toMatch(/backfilled/);
  });

  it("refuses jobs that are not approved (A2 gate)", async () => {
    (prisma.job.findFirst as any).mockResolvedValue({
      id: "job-1",
      greetingSentAt: null,
      Status: { value: "draft" },
    });
    const result = await handleMarkGreetingSent(
      { jobId: "job-1" } as any,
      "user-1",
      "tok",
    );
    expect(result.content[0].text).toMatch(/Refused/);
    expect(prisma.job.update).not.toHaveBeenCalled();
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing greetingSentAt", async () => {
    const existing = new Date("2026-07-25T10:00:00Z");
    (prisma.job.findFirst as any).mockResolvedValue({
      id: "job-1",
      greetingSentAt: existing,
      Status: { value: "approved" },
    });
    const result = await handleMarkGreetingSent(
      { jobId: "job-1" } as any,
      "user-1",
      "tok",
    );
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { greetingSentAt: existing },
    });
    expect(result.content[0].text).toMatch(/already set/);
  });

  it("reports not-found jobs", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);
    const result = await handleMarkGreetingSent(
      { jobId: "nope" } as any,
      "user-1",
      "tok",
    );
    expect(result.content[0].text).toMatch(/not found/i);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
