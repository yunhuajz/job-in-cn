import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/db";

// AJS lookups needed beyond signup()'s defaults (ADR-0005): the Boss直聘
// source platform, and the 待确认/已回复 kanban columns. signup() already
// seeds Applied/Interview/Offer/Rejected via JOB_STATUSES, so those are not
// repeated here.
export const AJS_JOB_SOURCES = [{ label: "Boss直聘", value: "boss" }] as const;

export const AJS_JOB_STATUSES = [
  { label: "待确认", value: "pending-confirmation" },
  { label: "已回复", value: "replied" },
  // design.md §5: 批准后落 JobStatus = 已批准
  { label: "已批准", value: "approved" },
] as const;

// Idempotent: safe to run repeatedly and reusable from any user-init flow.
export async function seedAjsLookups(userId: string, client: PrismaClient = prisma) {
  for (const source of AJS_JOB_SOURCES) {
    await client.jobSource.upsert({
      where: { value_createdBy: { value: source.value, createdBy: userId } },
      update: {},
      create: { ...source, createdBy: userId },
    });
  }

  for (const status of AJS_JOB_STATUSES) {
    await client.jobStatus.upsert({
      where: { value: status.value },
      update: {},
      create: status,
    });
  }
}
