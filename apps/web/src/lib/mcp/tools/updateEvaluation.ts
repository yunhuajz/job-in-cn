import { z } from "zod";
import prisma from "@/lib/db";
import { McpUpdateEvaluationSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

export const updateEvaluationToolDefinition = {
  name: "update_evaluation",
  description:
    "Write one scoring result (评估产物) for a job: the markdown evaluation report, the 1.0–5.0 score (stored ×20 as matchScore 0–100), and the raw scoring JSON. Does not change status or weekend/holiday confirmation fields.",
  inputSchema: McpUpdateEvaluationSchema,
} as const;

export async function handleUpdateEvaluation(
  input: z.infer<typeof McpUpdateEvaluationSchema>,
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
    JSON.parse(input.matchData);
  } catch {
    return {
      content: [
        {
          type: "text",
          text: "matchData is not valid JSON — pass the raw scoring output as a JSON string (score, dimensions, legality, missingInfo).",
        },
      ],
    };
  }

  const matchScore = Math.round(input.score * 20);

  try {
    await prisma.job.update({
      where: { id: input.jobId, userId },
      data: {
        evaluationReport: input.evaluationReport,
        matchScore,
        matchData: input.matchData,
      },
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
      {
        type: "text",
        text: `Evaluation saved for job ${input.jobId}: score ${input.score} (matchScore ${matchScore}).`,
      },
    ],
  };
}
