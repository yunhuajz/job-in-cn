import {
  createOpencliGreetIO,
  runGreetingBatch,
  type GreetIO,
  type GreetReport,
} from "@core/boss/greet";
import prisma from "@/lib/db";

export interface ExecuteGreetingInput {
  ids: string[];
  confirmed: boolean;
  io?: GreetIO;
}

export async function executeApprovedGreeting(
  input: ExecuteGreetingInput,
  userId: string,
): Promise<GreetReport> {
  if (!input.confirmed) {
    throw new Error("请先明确确认本批自动投递");
  }

  const jobs = await prisma.job.findMany({
    where: {
      id: { in: [...new Set(input.ids)] },
      userId,
      Status: { value: "draft" },
    },
    select: {
      id: true,
      jobUrl: true,
      JobTitle: { select: { label: true } },
      Company: { select: { label: true } },
      JobSource: { select: { label: true } },
    },
  });

  if (jobs.length === 0) {
    throw new Error("没有可投递的未投递岗位");
  }

  if (jobs.some((job) => !/boss/i.test(job.JobSource?.label ?? ""))) {
    throw new Error("当前自动投递仅支持 Boss 直聘岗位");
  }

  if (jobs.some((job) => !job.jobUrl)) {
    throw new Error("存在缺少原招聘链接的岗位");
  }

  const applied = await prisma.jobStatus.findUnique({
    where: { value: "applied" },
    select: { id: true },
  });

  if (!applied) {
    throw new Error("缺少“投递过”岗位进度");
  }

  const candidates = jobs.map((job) => ({
    id: job.id,
    jobTitle: job.JobTitle.label,
    company: job.Company.label,
    jobUrl: job.jobUrl!,
  }));

  const onMarkSent = async (jobId: string) => {
    await prisma.job.updateMany({
      where: { id: jobId, userId },
      data: {
        statusId: applied.id,
        applied: true,
        appliedDate: new Date(),
        greetingSentAt: new Date(),
      },
    });
    if (input.io?.markSent) {
      await input.io.markSent(jobId);
    }
  };

  const io: GreetIO = input.io
    ? {
        ...input.io,
        markSent: onMarkSent,
      }
    : createOpencliGreetIO(onMarkSent);

  return runGreetingBatch(candidates, io);
}
