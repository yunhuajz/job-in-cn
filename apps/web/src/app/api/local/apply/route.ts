import { auth } from "@/auth";
import prisma from "@/lib/db";
import { createOpencliGreetIO, runGreetingBatch } from "../../../../../../../src/boss/greet";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user) return new Response(null, { status: 401 });
    const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(20), confirmed: z.boolean() }).parse(await request.json());
    if (!body.confirmed) throw new Error("请先明确确认本批自动投递");
    const jobs = await prisma.job.findMany({
      where: { id: { in: [...new Set(body.ids)] }, userId: session.user.id, Status: { value: "draft" } },
      select: { id: true, jobUrl: true, JobTitle: { select: { label: true } }, Company: { select: { label: true } }, JobSource: { select: { label: true } } },
    });
    if (jobs.length === 0) throw new Error("没有可投递的未投递岗位");
    if (jobs.some((job) => !/boss/i.test(job.JobSource?.label ?? ""))) throw new Error("当前自动投递仅支持 Boss 直聘岗位");
    if (jobs.some((job) => !job.jobUrl)) throw new Error("存在缺少原招聘链接的岗位");
    const applied = await prisma.jobStatus.findUnique({ where: { value: "applied" }, select: { id: true } });
    if (!applied) throw new Error("缺少“投递过”岗位进度");
    const report = await runGreetingBatch(
      jobs.map((job) => ({ id: job.id, jobTitle: job.JobTitle.label, company: job.Company.label, jobUrl: job.jobUrl! })),
      createOpencliGreetIO(async (jobId) => {
        await prisma.job.updateMany({ where: { id: jobId, userId: session.user.id }, data: { statusId: applied.id, applied: true, appliedDate: new Date(), greetingSentAt: new Date() } });
      }),
    );
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "自动投递失败" }, { status: 400 });
  }
}
