import { z } from "zod";
import prisma from "@/lib/db";
import { McpMarkGreetingSentSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

// A2 闸(铁律):只有状态为 approved(用户在对话中复述清单并确认)的职位
// 才允许回写 greetingSentAt。服务端在这里再拦一道,不依赖调用方自觉。
const APPROVED_STATUS_VALUE = "approved";

export const markGreetingSentToolDefinition = {
  name: "mark_greeting_sent",
  description:
    "Mark that the Boss preset greeting was sent for a job: backfills greetingSentAt and adds a Note. Server-enforced gate: only jobs already in 'approved' status are accepted.",
  inputSchema: McpMarkGreetingSentSchema,
} as const;

export async function handleMarkGreetingSent(
  input: z.infer<typeof McpMarkGreetingSentSchema>,
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
      select: { id: true, greetingSentAt: true, Status: { select: { value: true } } },
    });
    if (!job) {
      return {
        content: [
          { type: "text", text: "Job not found or not owned by this token's user." },
        ],
      };
    }

    if (job.Status?.value !== APPROVED_STATUS_VALUE) {
      return {
        content: [
          {
            type: "text",
            text: `Refused: job ${input.jobId} is not in 'approved' status (current: ${job.Status?.value ?? "none"}). The user must approve it in conversation first (A2 gate).`,
          },
        ],
      };
    }

    const sentAt = input.sentAt ?? new Date();
    await prisma.$transaction([
      prisma.note.create({
        data: {
          jobId: input.jobId,
          userId,
          content: "已通过浏览器发送 Boss 预存常用语(一键沟通,非现场打字)。",
        },
      }),
      // 保留最早发送时间;已有值不覆盖(幂等)
      prisma.job.update({
        where: { id: input.jobId },
        data: { greetingSentAt: job.greetingSentAt ?? sentAt },
      }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: `Greeting marked for job ${input.jobId} (greetingSentAt ${job.greetingSentAt ? "already set" : "backfilled"}).`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
