import { auth } from "@/auth";
import prisma from "@/lib/db";
import { crawlerConfigSchema, matchesPreferences, monthlySalary, weekendStatus } from "@/lib/local/preferences";
import { z } from "zod";

export const dynamic = "force-dynamic";

const progressSchema = z.enum(["unapplied", "applied", "progress", "offer"]);
const progressStatusValues = { unapplied: "draft", applied: "applied", progress: "interview", offer: "offer" } as const;
const statusProgress = (value?: string) => ({ draft: "unapplied", applied: "applied", interview: "progress", offer: "offer" }[value ?? ""] ?? "unapplied");

export async function GET(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user) return new Response(null, { status: 401 });
    const query = new URL(request.url).searchParams;
    const weekendParam = query.get("weekend") ?? "any";
    const validWeekends = ["any", "yes", "yes_or_unknown", "no", "unknown"] as const;
    if (!validWeekends.includes(weekendParam as any)) throw new Error("双休筛选不正确");
    const config = crawlerConfigSchema.parse({
      keywords: ["岗位"], cities: ["全国"], location: query.get("location") ?? "",
      salaryMin: Number(query.get("salaryMin") ?? 0), salaryMax: Number(query.get("salaryMax") ?? 0),
      salaryMode: query.get("salaryMode") ?? "minimum", weekend: "any",
      experience: query.get("experience") ?? "any",
      keepUnknown: query.get("keepUnknown") !== "false",
    });
    const rawPage = Number(query.get("page") ?? 1);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const jobs = await prisma.job.findMany({
      where: { userId: session.user.id, OR: [{ discoveryStatus: null }, { discoveryStatus: { not: "dismissed" } }] },
      select: { id: true, JobTitle: true, Company: true, Location: true, JobSource: true, Status: true,
        salaryRange: true, description: true, weekendRestStatus: true, matchScore: true, jobUrl: true, createdAt: true,
        collections: { select: { collectedAt: true }, orderBy: { collectedAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    const text = (query.get("q") ?? "").trim().toLowerCase();
    const rawCity = (query.get("city") ?? "").trim();
    const cityKeywords = rawCity ? rawCity.split(/[\s,，]+/).filter(Boolean) : [];
    const source = query.get("source") ?? "";
    const progress = query.get("progress");
    if (progress && !progressSchema.safeParse(progress).success) throw new Error("岗位进度不正确");
    const scoreMin = Number(query.get("scoreMin") || 0);
    const scoreMax = Number(query.get("scoreMax") || 5);
    const scoreFilter = query.get("score") ?? "all";
    const from = query.get("from");
    const to = query.get("to");
    const startAt = from ? new Date(`${from}T00:00:00.000`) : null;
    const endAt = to ? new Date(`${to}T23:59:59.999`) : null;
    if ((startAt && Number.isNaN(startAt.valueOf())) || (endAt && Number.isNaN(endAt.valueOf()))) throw new Error("采集日期格式不正确");
    if (!Number.isFinite(scoreMin) || !Number.isFinite(scoreMax) || scoreMin < 0 || scoreMax > 5 || scoreMin > scoreMax) throw new Error("评分范围不正确");
    const validScoreFilters = ["all", "scored", "unscored", "4_plus", "3.5_plus", "3_plus", "under_3"] as const;
    if (!validScoreFilters.includes(scoreFilter as any)) throw new Error("评分筛选不正确");
    const sort = query.get("sort") ?? "collected_desc";
    if (!['collected_desc', 'collected_asc', 'score_desc', 'score_asc', 'salary_desc', 'salary_asc', 'title_desc', 'title_asc', 'location_desc', 'location_asc', 'source_desc', 'source_asc'].includes(sort)) throw new Error("排序方式不正确");
    const collectionDates = (job: typeof jobs[number]) => job.collections?.length ? job.collections.map((entry) => entry.collectedAt) : [job.createdAt];
    
    const matchCity = (locationLabel?: string) => {
      if (cityKeywords.length === 0) return true;
      if (!locationLabel) return false;
      return cityKeywords.some((keyword) => locationLabel.toLowerCase().includes(keyword.toLowerCase()));
    };

    const matchScore = (jobScore: number | null) => {
      if (scoreFilter === "all") {
        if (scoreMin > 0 || scoreMax < 5) {
          return jobScore != null && jobScore >= scoreMin * 20 && jobScore <= scoreMax * 20;
        }
        return true;
      }
      if (scoreFilter === "unscored") return jobScore == null;
      if (scoreFilter === "scored") return jobScore != null && jobScore >= scoreMin * 20 && jobScore <= scoreMax * 20;
      if (scoreFilter === "4_plus") return jobScore != null && jobScore >= 80;
      if (scoreFilter === "3.5_plus") return jobScore != null && jobScore >= 70;
      if (scoreFilter === "3_plus") return jobScore != null && jobScore >= 60;
      if (scoreFilter === "under_3") return jobScore != null && jobScore < 60;
      return true;
    };

    const matchWeekend = (weekend: "yes" | "no" | "unknown") => {
      if (weekendParam === "any") return true;
      if (weekendParam === "yes") return weekend === "yes";
      if (weekendParam === "yes_or_unknown") return weekend === "yes" || weekend === "unknown";
      if (weekendParam === "no") return weekend === "no";
      if (weekendParam === "unknown") return weekend === "unknown";
      return true;
    };

    const filtered = jobs.filter((job) => {
      const weekend = weekendStatus(job.description ?? "", job.weekendRestStatus);
      return (
        (!text || `${job.JobTitle?.label} ${job.Company?.label} ${job.description}`.toLowerCase().includes(text)) &&
        matchCity(job.Location?.label) &&
        (!source || job.JobSource?.label === source) &&
        (!progress || statusProgress(job.Status?.value) === progress) &&
        matchScore(job.matchScore) &&
        matchWeekend(weekend) &&
        collectionDates(job).some((collectedAt) => (!startAt || collectedAt >= startAt) && (!endAt || collectedAt <= endAt)) &&
        matchesPreferences({ salary: job.salaryRange, location: job.Location?.label, description: job.description ?? "", weekend: job.weekendRestStatus }, config)
      );
    });
    filtered.sort((left, right) => {
      if (sort === "collected_desc") return right.createdAt.valueOf() - left.createdAt.valueOf();
      if (sort === "collected_asc") return left.createdAt.valueOf() - right.createdAt.valueOf();
      if (sort.startsWith("title_")) return (sort.endsWith("desc") ? -1 : 1) * (left.JobTitle?.label ?? "").localeCompare(right.JobTitle?.label ?? "", "zh-CN");
      if (sort.startsWith("location_")) return (sort.endsWith("desc") ? -1 : 1) * (left.Location?.label ?? "").localeCompare(right.Location?.label ?? "", "zh-CN");
      if (sort.startsWith("source_")) return (sort.endsWith("desc") ? -1 : 1) * (left.JobSource?.label ?? "").localeCompare(right.JobSource?.label ?? "", "zh-CN");
      if (sort.startsWith("salary_")) {
        const leftSalary = monthlySalary(left.salaryRange ?? "");
        const rightSalary = monthlySalary(right.salaryRange ?? "");
        if (!leftSalary) return rightSalary ? 1 : 0;
        if (!rightSalary) return -1;
        return sort === "salary_desc" ? rightSalary.min - leftSalary.min : leftSalary.min - rightSalary.min;
      }
      if (left.matchScore == null) return right.matchScore == null ? 0 : 1;
      if (right.matchScore == null) return -1;
      return sort === "score_desc" ? right.matchScore - left.matchScore : left.matchScore - right.matchScore;
    });
    return Response.json({ total: filtered.length, page, pages: Math.max(1, Math.ceil(filtered.length / 25)),
      sources: [...new Set(jobs.map((j) => j.JobSource?.label).filter(Boolean))],
      jobs: filtered.slice((page - 1) * 25, page * 25).map((job) => ({
        id: job.id, title: job.JobTitle?.label ?? "", company: job.Company?.label ?? "",
        location: job.Location?.label ?? "", salary: job.salaryRange ?? "未知", source: job.JobSource?.label ?? "",
        status: job.Status?.label ?? "", score: job.matchScore, url: job.jobUrl,
        progress: statusProgress(job.Status?.value),
        firstCollectedAt: collectionDates(job)[0].toISOString(),
        collectedAt: collectionDates(job).at(-1)!.toISOString(),
        weekend: weekendStatus(job.description ?? "", job.weekendRestStatus),
      })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user) return new Response(null, { status: 401 });
    const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), progress: progressSchema }).parse(await request.json());
    const statusValue = progressStatusValues[body.progress];
    const status = await prisma.jobStatus.findUnique({ where: { value: statusValue }, select: { id: true } });
    if (!status) throw new Error(`缺少岗位进度“${body.progress}”`);
    const update = await prisma.job.updateMany({
      where: { id: { in: [...new Set(body.ids)] }, userId: session.user.id },
      data: body.progress === "unapplied" ? { statusId: status.id, applied: false, appliedDate: null } : { statusId: status.id, applied: true },
    });
    return Response.json({ updated: update.count });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "更新失败" }, { status: 400 });
  }
}
