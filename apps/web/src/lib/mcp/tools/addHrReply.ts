import { z } from "zod";
import prisma from "@/lib/db";
import { McpAddHrReplySchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

export const addHrReplyToolDefinition = {
  name: "add_hr_reply",
  description:
    "Record one HR reply for a job: stores the原文 as a Note and backfills hrReplyAt (ADR-0005). Read-only capture — never sends anything.",
  inputSchema: McpAddHrReplySchema,
} as const;

export async function handleAddHrReply(
  input: z.infer<typeof McpAddHrReplySchema>,
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
      select: { id: true, hrReplyAt: true },
    });
    if (!job) {
      return {
        content: [
          { type: "text", text: "Job not found or not owned by this token's user." },
        ],
      };
    }

    const repliedAt = input.repliedAt ?? new Date();
    await prisma.$transaction([
      prisma.note.create({
        data: { jobId: input.jobId, userId, content: input.content },
      }),
      // 保留最早回复时间;已有值不覆盖
      prisma.job.update({
        where: { id: input.jobId },
        data: { hrReplyAt: job.hrReplyAt ?? repliedAt },
      }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: `HR reply recorded for job ${input.jobId} (hrReplyAt ${job.hrReplyAt ? "already set" : "backfilled"}).`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
