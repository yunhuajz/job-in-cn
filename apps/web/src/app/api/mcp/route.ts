import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveMcpToken } from "@/lib/mcp/auth";
import {
  McpAddJobInputShape,
  McpAddJobSchema,
  McpAddHrReplyInputShape,
  McpAddHrReplySchema,
  McpAddNoteInputShape,
  McpAddNoteSchema,
  McpAddQuestionInputShape,
  McpAddQuestionSchema,
  McpGetJobInputShape,
  McpGetJobSchema,
  McpListJobsInputShape,
  McpListJobsSchema,
  McpMarkGreetingSentInputShape,
  McpMarkGreetingSentSchema,
  McpSaveMatchResultInputShape,
  McpSaveMatchResultSchema,
  McpSaveResumeVersionInputShape,
  McpSaveResumeVersionSchema,
  McpSetStatusInputShape,
  McpSetStatusSchema,
  McpUpdateEvaluationInputShape,
  McpUpdateEvaluationSchema,
} from "@/models/mcp.schema";
import { handleAddJob } from "@/lib/mcp/tools/addJob";
import { handleAddNote } from "@/lib/mcp/tools/addNote";
import { handleAddQuestion } from "@/lib/mcp/tools/addQuestion";
import { handleAddHrReply } from "@/lib/mcp/tools/addHrReply";
import { handleGetJob } from "@/lib/mcp/tools/getJob";
import { handleListJobs } from "@/lib/mcp/tools/listJobs";
import { handleMarkGreetingSent } from "@/lib/mcp/tools/markGreetingSent";
import { handleSaveMatchResult } from "@/lib/mcp/tools/saveMatchResult";
import { handleSaveResumeVersion } from "@/lib/mcp/tools/saveResumeVersion";
import { handleSetStatus } from "@/lib/mcp/tools/setStatus";
import { handleUpdateEvaluation } from "@/lib/mcp/tools/updateEvaluation";

function isMcpEnabled(): boolean {
  const env = process.env.MCP_ENABLED;
  if (env === "true") return true;
  if (env === "false") return false;
  // Default: on in dev, off in production
  return process.env.NODE_ENV !== "production";
}

async function handler(req: Request): Promise<Response> {
  if (!isMcpEnabled()) {
    return new Response("Not Found", { status: 404 });
  }

  const auth = await resolveMcpToken(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { userId, tokenName } = auth;

  const server = new McpServer({ name: "jobsync", version: "1.0.0" });

  server.tool(
    "add_job",
    "Add a job application to JobSync. Resolves or creates company, job title, location, and source by name. Returns a transparency report of what was matched vs. created.",
    McpAddJobInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpAddJobSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleAddJob(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "add_question",
    "Add an entry to the Question Bank. Resolves or creates tags by name. Returns a transparency report of what was matched vs. created.",
    McpAddQuestionInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("questions:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: questions:write",
            },
          ],
        };
      }
      const parsed = McpAddQuestionSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleAddQuestion(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "save_match_result",
    "Persist a job-fit match analysis (produced by you, the agent) against a job previously created with add_job. Call this after add_job hands you a match directive.",
    McpSaveMatchResultInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpSaveMatchResultSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleSaveMatchResult(parsed.data, userId, tokenName);
    },
  );

  // --- AJS tools (docs/design.md, docs/adr/0005-data-contract.md) ---

  server.tool(
    "update_evaluation",
    "Write one scoring result (评估产物) for a job: the markdown evaluation report, the 1.0–5.0 score (stored ×20 as matchScore 0–100), and the raw scoring JSON. Does not change status or weekend/holiday confirmation fields.",
    McpUpdateEvaluationInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpUpdateEvaluationSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleUpdateEvaluation(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "set_status",
    "Set a job's kanban status by name (e.g. '已批准' after user approval, '待确认', '已回复', or a built-in like 'Applied'). Only statuses that already exist are accepted.",
    McpSetStatusInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpSetStatusSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleSetStatus(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "save_resume_version",
    "Create a tailored Resume row for a job and link it. The resume is named 'Boss-<公司>-<岗位>-vN' with N incrementing per company/role (ADR-0005).",
    McpSaveResumeVersionInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpSaveResumeVersionSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleSaveResumeVersion(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "add_note",
    "Add a Note to a job — the carrier for the greeting sent or the HR reply原文 (ADR-0005).",
    McpAddNoteInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpAddNoteSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleAddNote(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "add_hr_reply",
    "Record one HR reply for a job: stores the原文 as a Note and backfills hrReplyAt (ADR-0005). Read-only capture — never sends anything.",
    McpAddHrReplyInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpAddHrReplySchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleAddHrReply(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "mark_greeting_sent",
    "Mark that the Boss preset greeting was sent for a job: backfills greetingSentAt and adds a Note. Server-enforced gate: only jobs already in 'approved' status are accepted.",
    McpMarkGreetingSentInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpMarkGreetingSentSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleMarkGreetingSent(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "get_job",
    "Fetch one job in full, including the plain-text job description — the input for LLM scoring (design.md §4).",
    McpGetJobInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpGetJobSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleGetJob(parsed.data, userId, tokenName);
    },
  );

  server.tool(
    "list_jobs",
    "List the user's jobs (newest first) for the 今日汇总 / 批准清单. Optional filters: status name, minMatchScore (0–100), createdAt since. Returns slim rows: id, jobTitle, company, city, salary, matchScore, weekendRestStatus, status.",
    McpListJobsInputShape,
    async (rawInput) => {
      if (!auth.scopes.includes("jobs:write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Insufficient scope. Required: jobs:write",
            },
          ],
        };
      }
      const parsed = McpListJobsSchema.safeParse(rawInput);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join("; ");
        return {
          content: [
            { type: "text" as const, text: `Validation error: ${issues}` },
          ],
        };
      }
      return handleListJobs(parsed.data, userId, tokenName);
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true, // return plain JSON instead of SSE stream
  });

  await server.connect(transport);
  const response = await transport.handleRequest(req);
  await server.close();

  return response;
}

// GET is for SSE server-push streams — not supported in stateless mode
async function getHandler(): Promise<Response> {
  return new Response("Method Not Allowed", { status: 405 });
}

export { getHandler as GET, handler as POST, handler as DELETE };
