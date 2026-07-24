import type { PrismaClient, User } from "@prisma/client";
import { JOB_SOURCES, JOB_STATUSES } from "@/lib/constants";
import {
  seedAjsLookups,
  AJS_JOB_SOURCES,
  AJS_JOB_STATUSES,
} from "@/lib/ajs/seedAjsData";
import { createAjsTestDb } from "./helpers/ajsTestDb";

// The AJS kanban needs 待确认/已投/已回复/面试/Offer/已拒. signup() already
// seeds Applied/Interview/Offer/Rejected (已投/面试/Offer/已拒) via JOB_STATUSES,
// so the seed only adds what AJS needs beyond those defaults: 待确认 + 已回复,
// plus the Boss直聘 JobSource.
describe("AJS seed (seedAjsLookups)", () => {
  let prisma: PrismaClient;
  let cleanup: () => Promise<void>;
  let user: User;

  beforeAll(async () => {
    ({ prisma, cleanup } = createAjsTestDb("seed"));
    user = await prisma.user.create({
      data: { name: "AJS Seed", email: "ajs-seed@example.com", password: "x" },
    });

    // Replicate signup()'s initialization (auth.actions.ts) so the seed is
    // tested against the same baseline a real user starts from.
    await prisma.jobSource.createMany({
      data: JOB_SOURCES.map((source) => ({
        label: source.label,
        value: source.value,
        createdBy: user.id,
      })),
    });
    for (const status of JOB_STATUSES) {
      await prisma.jobStatus.upsert({
        where: { value: status.value },
        update: {},
        create: status,
      });
    }
  }, 120000);

  afterAll(async () => {
    await cleanup();
  });

  it("creates the Boss直聘 JobSource for the user", async () => {
    await seedAjsLookups(user.id, prisma);

    const source = await prisma.jobSource.findFirst({
      where: { label: "Boss直聘", createdBy: user.id },
    });
    expect(source).not.toBeNull();
    expect(source?.value).toBe(AJS_JOB_SOURCES[0].value);
  });

  it("adds 待确认 and 已回复 statuses without duplicating signup defaults", async () => {
    await seedAjsLookups(user.id, prisma);

    const statuses = await prisma.jobStatus.findMany();
    const byValue = new Map(statuses.map((s) => [s.value, s.label]));

    // AJS-required columns already covered by signup defaults (不要重复造).
    expect(byValue.get("applied")).toBe("Applied");
    expect(byValue.get("interview")).toBe("Interview");
    expect(byValue.get("offer")).toBe("Offer");
    expect(byValue.get("rejected")).toBe("Rejected");

    // Columns the seed must add.
    for (const status of AJS_JOB_STATUSES) {
      expect(byValue.get(status.value)).toBe(status.label);
    }
    expect(AJS_JOB_STATUSES.map((s) => s.label)).toEqual([
      "待确认",
      "已回复",
      "已批准",
    ]);
  });

  it("seeds 已批准 so approvals can land JobStatus = 已批准 (design.md §5)", async () => {
    await seedAjsLookups(user.id, prisma);

    const approved = await prisma.jobStatus.findUnique({
      where: { value: "approved" },
    });
    expect(approved).not.toBeNull();
    expect(approved?.label).toBe("已批准");
  });

  it("is idempotent: a second run creates no duplicate rows", async () => {
    await seedAjsLookups(user.id, prisma);
    const sourcesBefore = await prisma.jobSource.count({
      where: { createdBy: user.id },
    });
    const statusesBefore = await prisma.jobStatus.count();

    await seedAjsLookups(user.id, prisma);

    expect(await prisma.jobSource.count({ where: { createdBy: user.id } })).toBe(
      sourcesBefore
    );
    expect(await prisma.jobStatus.count()).toBe(statusesBefore);
  });
});
