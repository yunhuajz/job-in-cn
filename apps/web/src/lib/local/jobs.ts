import prisma from "@/lib/db";
import { createJobFromNames, type CreateJobFromNamesInput, type CreateJobFromNamesResult } from "@/lib/jobs/createJobFromNames";

export async function recordCrawledJob(
  input: CreateJobFromNamesInput,
  userId: string,
  collectedAt = new Date(),
): Promise<CreateJobFromNamesResult> {
  const result = await createJobFromNames(input, userId);
  const jobId = result.jobId ?? result.duplicateOf?.id;
  if (jobId) await prisma.jobCollection.create({ data: { jobId, collectedAt } });
  return result;
}
