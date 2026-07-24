import { z } from "zod";
import prisma from "@/lib/db";
import { McpSetStatusSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

export const setStatusToolDefinition = {
  name: "set_status",
  description:
    "Set a job's kanban status by name (e.g. '已批准' after user approval, '待确认', '已回复', or a built-in like 'Applied'). Only statuses that already exist are accepted.",
  inputSchema: McpSetStatusSchema,
} as const;

export async function handleSetStatus(
  input: z.infer<typeof McpSetStatusSchema>,
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

  try {
    await prisma.job.update({
      where: { id: input.jobId, userId },
      data: { statusId: status.id },
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return {
        content: [
          { type: "text", text: "Job not found or not owned by this token's user." },
        ],
      };
    }
    return {
      content: [{ type: "text", text: `Error: ${error?.message ?? "Unknown error"}` }],
    };
  }

  return {
    content: [
      { type: "text", text: `Status of job ${input.jobId} set to "${status.label}".` },
    ],
  };
}
