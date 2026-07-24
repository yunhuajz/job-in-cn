import type { PrismaClient, User, JobStatus, JobTitle, Company } from "@prisma/client";
import { createAjsTestDb } from "./helpers/ajsTestDb";

// ADR-0005: Job gains exactly five AJS columns. This spec exercises them
// through Prisma Client against a real migrated SQLite test DB.
describe("Job AJS data contract (ADR-0005)", () => {
  let prisma: PrismaClient;
  let cleanup: () => Promise<void>;
  let user: User;
  let status: JobStatus;
  let jobTitle: JobTitle;
  let company: Company;

  beforeAll(async () => {
    ({ prisma, cleanup } = createAjsTestDb("contract"));
    user = await prisma.user.create({
      data: { name: "AJS Contract", email: "ajs-contract@example.com", password: "x" },
    });
    status = await prisma.jobStatus.create({
      data: { label: "Applied", value: "applied" },
    });
    jobTitle = await prisma.jobTitle.create({
      data: { label: "工程师", value: "engineer", createdBy: user.id },
    });
    company = await prisma.company.create({
      data: { label: "某公司", value: "acme", createdBy: user.id },
    });
  }, 120000);

  afterAll(async () => {
    await cleanup();
  });

  const baseJob = () => ({
    userId: user.id,
    description: "一份 JD",
    jobType: "full-time",
    createdAt: new Date(),
    statusId: status.id,
    jobTitleId: jobTitle.id,
    companyId: company.id,
  });

  it("persists and reads back the five AJS columns", async () => {
    const greetingSentAt = new Date("2026-07-20T09:00:00.000Z");
    const hrReplyAt = new Date("2026-07-21T03:30:00.000Z");

    const job = await prisma.job.create({
      data: {
        ...baseJob(),
        evaluationReport: "# 评估报告\n\n4.2 分,建议投递。",
        weekendRestStatus: "pending",
        holidayStatus: "yes",
        greetingSentAt,
        hrReplyAt,
      },
    });

    const read = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(read.evaluationReport).toBe("# 评估报告\n\n4.2 分,建议投递。");
    expect(read.weekendRestStatus).toBe("pending");
    expect(read.holidayStatus).toBe("yes");
    expect(read.greetingSentAt).toEqual(greetingSentAt);
    expect(read.hrReplyAt).toEqual(hrReplyAt);
  });

  it("defaults weekendRestStatus/holidayStatus to none and leaves the rest null", async () => {
    const job = await prisma.job.create({ data: baseJob() });

    const read = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(read.weekendRestStatus).toBe("none");
    expect(read.holidayStatus).toBe("none");
    expect(read.evaluationReport).toBeNull();
    expect(read.greetingSentAt).toBeNull();
    expect(read.hrReplyAt).toBeNull();
  });
});
