import { z } from "zod";
import prisma from "@/lib/db";
import { McpGetJobSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { removeHtmlTags } from "@/lib/ai/tools/text-processing";

export const getJobToolDefinition = {
  name: "get_job",
  description:
    "Fetch one job in full, including the plain-text job description — the input for LLM scoring (design.md §4).",
  inputSchema: McpGetJobSchema,
} as const;

export async function handleGetJob(
  input: z.infer<typeof McpGetJobSchema>,
  userId: string,
  _tokenName: string,
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
        description: true,
        salaryRange: true,
        jobUrl: true,
        matchScore: true,
        weekendRestStatus: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Location: { select: { label: true } },
        Status: { select: { label: true } },
        JobSource: { select: { label: true } },
      },
    });
    if (!job) {
      return {
        content: [
          { type: "text", text: "Job not found or not owned by this token's user." },
        ],
      };
    }
    const row = {
      id: job.id,
      jobTitle: job.JobTitle.label,
      company: job.Company.label,
      city: job.Location?.label ?? null,
      salary: job.salaryRange,
      source: job.JobSource?.label ?? null,
      status: job.Status.label,
      matchScore: job.matchScore,
      weekendRestStatus: job.weekendRestStatus,
      jobUrl: job.jobUrl,
      // 库存为渲染后的 HTML,评分需要的是纯文本 JD
      jobDescription: removeHtmlTags(job.description),
    };
    return { content: [{ type: "text", text: JSON.stringify(row) }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
