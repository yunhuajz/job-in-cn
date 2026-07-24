import { handleSaveResumeVersion } from "@/lib/mcp/tools/saveResumeVersion";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: { findFirst: vi.fn(), update: vi.fn() },
    resume: { findMany: vi.fn(), create: vi.fn() },
    profile: { findFirst: vi.fn(), create: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/mcp/rate-limit", () => ({
  checkMcpRateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

const jobWithNames = {
  id: "job-1",
  Company: { label: "阿里" },
  JobTitle: { label: "前端工程师" },
};

describe("handleSaveResumeVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.job.findFirst as any).mockResolvedValue(jobWithNames);
    (prisma.resume.findMany as any).mockResolvedValue([]);
    (prisma.profile.findFirst as any).mockResolvedValue({ id: "profile-1" });
    (prisma.resume.create as any).mockResolvedValue({ id: "resume-1" });
    (prisma.job.update as any).mockResolvedValue({ id: "job-1" });
  });

  it("creates a Resume named Boss-<公司>-<岗位>-v1 and links it to the job", async () => {
    const result = await handleSaveResumeVersion(
      { jobId: "job-1" },
      "user-1",
      "my-token",
    );

    expect(prisma.resume.create).toHaveBeenCalledWith({
      data: { profileId: "profile-1", title: "Boss-阿里-前端工程师-v1" },
    });
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-1" },
      data: { resumeId: "resume-1" },
    });
    expect(result.content[0].text).toContain("Boss-阿里-前端工程师-v1");
    expect(result.content[0].text).toContain("resume-1");
  });

  it("increments the version from existing Boss-<公司>-<岗位>-vN resumes (ADR-0005)", async () => {
    (prisma.resume.findMany as any).mockResolvedValue([
      { title: "Boss-阿里-前端工程师-v1" },
      { title: "Boss-阿里-前端工程师-v2" },
    ]);

    await handleSaveResumeVersion({ jobId: "job-1" }, "user-1", "my-token");

    expect(prisma.resume.findMany).toHaveBeenCalledWith({
      where: {
        profile: { userId: "user-1" },
        title: { startsWith: "Boss-阿里-前端工程师-v" },
      },
      select: { title: true },
    });
    expect(prisma.resume.create).toHaveBeenCalledWith({
      data: { profileId: "profile-1", title: "Boss-阿里-前端工程师-v3" },
    });
  });

  it("creates the profile first when the user has none", async () => {
    (prisma.profile.findFirst as any).mockResolvedValue(null);
    (prisma.profile.create as any).mockResolvedValue({ id: "profile-new" });

    await handleSaveResumeVersion({ jobId: "job-1" }, "user-2", "my-token");

    expect(prisma.profile.create).toHaveBeenCalledWith({
      data: { userId: "user-2" },
    });
    expect(prisma.resume.create).toHaveBeenCalledWith({
      data: { profileId: "profile-new", title: "Boss-阿里-前端工程师-v1" },
    });
  });

  it("returns an error and creates nothing when the job does not exist or is not owned", async () => {
    (prisma.job.findFirst as any).mockResolvedValue(null);

    const result = await handleSaveResumeVersion(
      { jobId: "someone-elses-job" },
      "user-3",
      "my-token",
    );

    expect(result.content[0].text).toContain("Job not found");
    expect(prisma.resume.create).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it("returns a rate-limit message and never writes when the limit is exceeded", async () => {
    (checkMcpRateLimit as any).mockReturnValueOnce({ allowed: false, resetIn: 60000 });

    const result = await handleSaveResumeVersion(
      { jobId: "job-1" },
      "user-4",
      "my-token",
    );

    expect(result.content[0].text).toContain("Rate limit exceeded");
    expect(prisma.resume.create).not.toHaveBeenCalled();
  });
});
