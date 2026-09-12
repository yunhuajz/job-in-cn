import { ingestJob, type IngestJobInput, type IngestJobResult } from "./ingest";

export type CreateJobFromNamesInput = IngestJobInput;
export type CreateJobFromNamesResult = IngestJobResult;

export async function createJobFromNames(
  input: CreateJobFromNamesInput,
  userId: string,
): Promise<CreateJobFromNamesResult> {
  return ingestJob(input, userId);
}

