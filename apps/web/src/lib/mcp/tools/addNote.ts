import { z } from "zod";
import prisma from "@/lib/db";
import { McpAddNoteSchema } from "@/models/mcp.schema";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

export const addNoteToolDefinition = {
  name: "add_note",
  description:
    "Add a Note to a job — the carrier for the greeting sent or the HR reply原文 (ADR-0005).",
  inputSchema: McpAddNoteSchema,
} as const;

export async function handleAddNote(
  input: z.infer<typeof McpAddNoteSchema>,
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

  // Mirrors addNote (note.actions.ts): verify the job belongs to the caller
  // before creating the note. The action is session-bound, so the MCP path
  // applies the same logic with the token's userId.
  try {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, userId },
      select: { id: true },
    });
    if (!job) {
      return {
        content: [
          { type: "text", text: "Job not found or not owned by this token's user." },
        ],
      };
    }

    const note = await prisma.note.create({
      data: { jobId: input.jobId, userId, content: input.content },
    });

    return {
      content: [
        { type: "text", text: `Note added to job ${input.jobId} (note id: ${note.id}).` },
      ],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err?.message ?? "Unknown error"}` }],
    };
  }
}
