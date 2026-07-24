import { z } from "zod";
import prisma from "@/lib/db";
import { McpSaveResumeVersionSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

export const saveResumeVersionToolDefinition = {
  name: "save_resume_version",
  description:
    "Create a tailored Resume row for a job and link it. The resume is named 'Boss-<公司>-<岗位>-vN' with N incrementing per company/role (ADR-0005).",
  inputSchema: McpSaveResumeVersionSchema,
} as const;

export async function handleSaveResumeVersion(
  input: z.infer<typeof McpSaveResumeVersionSchema>,
  userId: string,
  tokenName: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const rateCheck = checkMcpRateLimit(userId);
  if (!rateCheck.allowed) {
    const resetSec = Math.ceil(rateCheck.resetIn / 1000);
    return {
      content: [{ type: "text", text: `Rate limit exceeded. Try again in ${resetSec}s.` }],
    };
  }

  try {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, userId },
      select: {
        id: true,
        Company: { select: { label: true } },
        JobTitle: { select: { label: true } },
      },
    });
    if (!job) {
      return {
        content: [
          { type: "text", text: "Job not found or not owned by this token's user." },
        ],
      };
    }

    // Mirrors createResumeProfile (profile.actions.ts): the resume hangs off
    // the user's Profile, which is created on first use. Title versioning
    // follows the ADR-0005 convention instead of that action's " (2)" suffix.
    const base = `Boss-${job.Company.label}-${job.JobTitle.label}-v`;
    const existing = await prisma.resume.findMany({
      where: { profile: { userId }, title: { startsWith: base } },
      select: { title: true },
    });
    const title = `${base}${existing.length + 1}`;

    let profile = await prisma.profile.findFirst({ where: { userId } });
    if (!profile) {
      profile = await prisma.profile.create({ data: { userId } });
    }

    const resume = await prisma.resume.create({
      data: { profileId: profile.id, title },
    });

    await prisma.job.update({
      where: { id: job.id, userId },
      data: { resumeId: resume.id },
    });

    return {
      content: [
        {
          type: "text",
          text: `Resume version "${title}" created (id: ${resume.id}) and linked to job ${job.id}.`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
