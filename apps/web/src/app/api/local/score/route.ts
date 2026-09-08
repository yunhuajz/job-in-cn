import "server-only";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getDefaultResumeForUser } from "@/lib/jobs/getDefaultResumeForUser";
import { buildJobMatchPrompt, JOB_MATCH_SYSTEM_PROMPT, parseJobMatch, preprocessResume, preprocessText } from "@/lib/ai";
import { extractResumeFileText } from "@/lib/jobs/extractResumeFileText";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import { defaultUserSettings, type UserSettingsData } from "@/models/userSettings.model";
import { generateText } from "ai";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(10) }).parse(await request.json());
    const row = await prisma.userSettings.findUnique({ where: { userId }, select: { settings: true } });
    const settings: UserSettingsData = row ? { ...defaultUserSettings, ...JSON.parse(row.settings) } : defaultUserSettings;
    const activeProfile = settings.aiProfiles?.find((p) => p.isActive) || settings.aiProfiles?.[0];
    const targetModel = activeProfile?.model || settings.ai.model;
    const targetBaseURL = activeProfile?.baseURL || settings.ai.baseURL;
    const targetProtocol = activeProfile?.protocol || settings.ai.protocol;
    if (!targetModel) throw new Error("请先在“AI 设置”中选择评分模型");
    const resume = await getDefaultResumeForUser(userId);
    if (!resume) throw new Error("请先在个人资料中设置默认简历");
    let prepared = await preprocessResume(resume);
    if (!prepared.success && resume.File?.filePath) {
      const fileText = await extractResumeFileText(resume.File.filePath);
      if (fileText) {
        prepared = await preprocessText(`# ${resume.title}\n\n${fileText}`);
      }
    }
    if (!prepared.success) {
      if (prepared.error.code === "TOO_SHORT" || prepared.error.code === "NO_CONTENT") {
        const chars = (prepared.error.details as any)?.characterCount ?? 0;
        throw new Error(
          `当前默认简历“${resume.title}”有效内容过少（有效字数 ${chars}，至少需 200 字）。请先在“个人资料”中添加工作经历或上传完整简历。`
        );
      }
      throw new Error(prepared.error.message);
    }
    const model = await getModel(settings.ai.provider as ProviderType, targetModel, userId, { baseURL: targetBaseURL, protocol: targetProtocol });
    const jobs = await prisma.job.findMany({
      where: { userId, id: { in: [...new Set(ids)] } },
      select: { id: true, description: true, salaryRange: true, JobTitle: { select: { label: true } }, Company: { select: { label: true } }, Location: { select: { label: true } } },
    });
    let scored = 0;
    const failures: string[] = [];
    for (const job of jobs) {
      try {
        const jobText = `${job.JobTitle.label} @ ${job.Company.label}\n地点：${job.Location?.label ?? "未知"}\n薪资：${job.salaryRange ?? "未知"}\n\n${job.description}`;
        const result = await generateText({ model, system: JOB_MATCH_SYSTEM_PROMPT, prompt: buildJobMatchPrompt(prepared.data.normalizedText, jobText), temperature: 0.3 });
        const parsed = parseJobMatch(result.text);
        if (!parsed.scores) throw new Error("模型没有返回可识别的评分");
        await prisma.job.update({ where: { id: job.id, userId }, data: {
          matchScore: parsed.scores.matchScore,
          evaluationReport: parsed.body,
          matchData: JSON.stringify({ ...parsed.scores, body: parsed.body, resumeId: resume.id, resumeTitle: resume.title, matchedAt: new Date().toISOString(), provider: settings.ai.provider, model: settings.ai.model }),
        } });
        scored += 1;
      } catch (error) { failures.push(`${job.JobTitle.label}：${error instanceof Error ? error.message : "评分失败"}`); }
    }
    return Response.json({ scored, failed: failures.length, failures });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "评分失败" }, { status: 400 });
  }
}
