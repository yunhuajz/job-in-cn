import { handleUpdateEvaluation } from "@/lib/mcp/tools/updateEvaluation";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: { update: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const baseInput = {
  jobId: "job-1",
  score: 4.2,
  evaluationReport: "## 评估\nAI Agent 方向强匹配,JD 未写双休。",
  matchData: JSON.stringify({
    score: 4.2,
    dimensions: { constraints: 4, salary: 3, company: 3.5, skills: 4.5, city: 5 },
    missingInfo: ["weekend_rest"],
    legality: "ok",
  }),
};

describe("handleUpdateEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.update as any).mockResolvedValue({ id: "job-1" });
  });

  it("persists evaluationReport + matchData and stores score ×20 as matchScore", async () => {
    const result = await handleUpdateEvaluation(baseInput, "user-1", "my-token");

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: {
        evaluationReport: baseInput.evaluationReport,
        matchScore: 84,
        matchData: baseInput.matchData,
      },
    });
    expect(result.content[0].text).toContain("job-1");
    expect(result.content[0].text).toContain("84");
  });

  it("does not touch weekendRestStatus/holidayStatus — those only change via set_status/回复回填", async () => {
    await handleUpdateEvaluation(baseInput, "user-1", "my-token");

    const data = (prisma.job.update as any).mock.calls[0][0].data;
    expect(data).not.toHaveProperty("weekendRestStatus");
    expect(data).not.toHaveProperty("holidayStatus");
  });

  it("returns an error and writes nothing when matchData is not valid JSON", async () => {
    const result = await handleUpdateEvaluation(
      { ...baseInput, matchData: "not json" },
      "user-2",
      "my-token",
    );

    expect(result.content[0].text).toContain("matchData");
    expect(result.content[0].text).toContain("JSON");
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it("returns a not-found message when the job does not exist or is not owned (P2025)", async () => {
    (prisma.job.update as any).mockRejectedValue({ code: "P2025" });

    const result = await handleUpdateEvaluation(
      { ...baseInput, jobId: "someone-elses-job" },
      "user-3",
      "my-token",
    );

    expect(result.content[0].text).toContain("Job not found");
  });

  it("surfaces a generic error message on a non-P2025 DB failure", async () => {
    (prisma.job.update as any).mockRejectedValue({ message: "connection reset" });

    const result = await handleUpdateEvaluation(baseInput, "user-4", "my-token");

    expect(result.content[0].text).toContain("Error: connection reset");
  });

  it("returns a rate-limit message and never persists when the limit is exceeded", async () => {
    (checkMcpRateLimit as any).mockReturnValueOnce({ allowed: false, resetIn: 60000 });

    const result = await handleUpdateEvaluation(baseInput, "user-5", "my-token");

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
