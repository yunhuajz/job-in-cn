import { auth } from "@/auth";
import { configStore, crawler } from "@/lib/local/crawler";
import { recordCrawledJob } from "@/lib/local/jobs";
import { crawlerConfigSchema, crawlerPlanSchema, platforms } from "../../../../../../../src/crawler/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  return Response.json({ configs: platforms.map((p) => configStore.read(p)), plan: configStore.readPlan(), recovery: configStore.readCheckpoint(), run: crawler.snapshot() });
}

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const body = await request.json();
    if (body.action === "continue") {
      const session = await auth();
      if (!session?.user) return new Response(null, { status: 401 });
      const checkpoint = configStore.readCheckpoint();
      if (!checkpoint) return Response.json({ error: "没有可恢复的采集任务" }, { status: 400 });
      if (['running', 'paused', 'stopping'].includes(crawler.snapshot().status)) return Response.json({ error: "正在采集，请先停止当前任务" }, { status: 409 });
      crawler.start(checkpoint.plan, checkpoint.configs, (job) => recordCrawledJob({ ...job, createdVia: "jbcn" }, session.user.id), checkpoint.next);
    } else if (body.action === "stop") crawler.stop();
    else if (body.action === "pause") {
      const hours = body.hours === 1 || body.hours === 2 ? body.hours : null;
      if (!hours) return Response.json({ error: "暂停时长只能是 1 或 2 小时" }, { status: 400 });
      crawler.pauseFor(hours);
    } else if (body.action === "resume") crawler.resume();
    else if (body.action === "save" || body.action === "start") {
      const config = crawlerConfigSchema.parse(body.config);
      if (body.action === "start") {
        const session = await auth();
        if (!session?.user) return new Response(null, { status: 401 });
        if (['running', 'stopping'].includes(crawler.snapshot().status)) return Response.json({ error: "正在采集，请先停止当前任务" }, { status: 409 });
        const plan = crawlerPlanSchema.parse(body.plan ?? configStore.readPlan());
        const configs = Array.isArray(body.configs) ? body.configs.map((item: unknown) => crawlerConfigSchema.parse(item)) : platforms.map((platform) => configStore.read(platform));
        configStore.save(config);
        for (const item of configs) configStore.save(item);
        configStore.savePlan(plan);
        crawler.start(plan, configs, (job) => recordCrawledJob({ ...job, createdVia: "jbcn" }, session.user.id));
      } else {
        configStore.save(config);
        if (body.plan) configStore.savePlan(crawlerPlanSchema.parse(body.plan));
      }
    } else if (body.action === "save-plan") configStore.savePlan(crawlerPlanSchema.parse(body.plan));
    else return Response.json({ error: "未知操作" }, { status: 400 });
    return GET();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "操作失败" }, { status: 400 });
  }
}
