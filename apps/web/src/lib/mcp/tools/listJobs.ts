import { z } from "zod";
import prisma from "@/lib/db";
import { McpListJobsSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

const DEFAULT_LIMIT = 20;

export const listJobsToolDefinition = {
  name: "list_jobs",
  description:
    "List the user's jobs (newest first) for the 今日汇总 / 批准清单. Optional filters: status name, minMatchScore (0–100), createdAt since. Returns slim rows: id, jobTitle, company, city, salary, matchScore, weekendRestStatus, status.",
  inputSchema: McpListJobsSchema,
} as const;

export async function handleListJobs(
  input: z.infer<typeof McpListJobsSchema>,
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
    let statusId: string | undefined;
    if (input.status) {
      const status = await prisma.jobStatus.findFirst({
        where: { OR: [{ label: input.status }, { value: input.status }] },
      });
      if (!status) {
        return {
          content: [
            {
              type: "text",
              text: `Status "${input.status}" not found. Only statuses that already exist in the kanban are accepted.`,
            },
          ],
        };
      }
      statusId = status.id;
    }

    const jobs = await prisma.job.findMany({
      where: {
        userId,
        ...(statusId ? { statusId } : {}),
        ...(input.minMatchScore != null
          ? { matchScore: { gte: input.minMatchScore } }
          : {}),
        ...(input.since ? { createdAt: { gte: input.since } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? DEFAULT_LIMIT,
      select: {
        id: true,
        matchScore: true,
        salaryRange: true,
        weekendRestStatus: true,
        JobTitle: { select: { label: true } },
        Company: { select: { label: true } },
        Location: { select: { label: true } },
        Status: { select: { label: true } },
      },
    });

    const rows = jobs.map((job) => ({
      id: job.id,
      jobTitle: job.JobTitle.label,
      company: job.Company.label,
      city: job.Location?.label ?? null,
      salary: job.salaryRange,
      matchScore: job.matchScore,
      weekendRestStatus: job.weekendRestStatus,
      status: job.Status.label,
    }));

    return { content: [{ type: "text", text: JSON.stringify(rows) }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
