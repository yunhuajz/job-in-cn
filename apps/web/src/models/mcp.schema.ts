import { z } from "zod";
import { APP_CONSTANTS } from "@/lib/constants";

// Raw input shape for MCP tool registration (no transforms — SDK uses this for JSON schema)
export const McpAddJobInputShape = {
  company: z.string().min(1, "company is required"),
  jobTitle: z.string().min(1, "jobTitle is required"),
  jobDescription: z.string().min(10, "jobDescription must be at least 10 characters")
    .describe("The complete job posting text, copied in full — do not summarize, shorten, or paraphrase it. Markdown-formatted is supported; plain text also works."),
  location: z.string().optional().describe("City, province/state, country, or 'Remote' — e.g. 'Calgary, AB'. Do not include a street address."),
  source: z.string().optional().describe("Job board or site the listing came from, e.g. 'LinkedIn', 'Indeed', 'company website'. If not stated explicitly, infer it from the job posting's URL/domain when possible instead of leaving it blank."),
  jobType: z.string().optional().describe("Employment type: 'Full-time', 'Part-time', or 'Contract'"),
  workplaceType: z.string().optional().describe("Work arrangement: 'Remote', 'Hybrid', or 'Onsite'"),
  status: z.string().optional().describe("Application status: draft, applied, interview, offer, rejected, expired, or archived. Defaults to 'draft'"),
  dueDate: z.string().datetime({ offset: true }).optional().describe("Application deadline as an ISO-8601 datetime string"),
  applied: z.boolean().optional().describe("Set true if you have already submitted the application"),
  appliedDate: z.string().datetime({ offset: true }).optional().describe("Date the application was submitted as an ISO-8601 datetime string"),
  jobUrl: z.string().url().optional().describe("Direct URL to the job posting"),
  salaryRange: z.string().optional().describe("Salary range as a free-form string, e.g. '$120k–$150k' or '100,000 CAD'"),
  tags: z.array(z.string()).optional().describe("Skills required for the job (max 10 applied, extras are dropped). Tags are created if they don't exist. e.g. ['React', 'TypeScript', 'Node.js']"),
  allowDuplicate: z.boolean().optional(),
};

// Full schema with transforms for parsing raw MCP input in the handler
export const McpAddJobSchema = z.object({
  ...McpAddJobInputShape,
  dueDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  appliedDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type McpAddJobInput = z.infer<typeof McpAddJobSchema>;

// Raw input shape for MCP tool registration (no transforms — SDK uses this for JSON schema)
export const McpAddQuestionInputShape = {
  question: z.string()
    .min(APP_CONSTANTS.MIN_QUESTION_LENGTH, `question must be at least ${APP_CONSTANTS.MIN_QUESTION_LENGTH} characters`)
    .max(APP_CONSTANTS.MAX_QUESTION_LENGTH, `question cannot exceed ${APP_CONSTANTS.MAX_QUESTION_LENGTH} characters`),
  answer: z.string()
    .min(APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH, `answer must be at least ${APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH} characters`)
    .max(APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH, `answer cannot exceed ${APP_CONSTANTS.MAX_QUESTION_ANSWER_LENGTH} characters`)
    .describe("Markdown-formatted answer/notes (required). Plain text also works."),
  tags: z.array(z.string()).optional()
    .describe("Skill/topic tags (max 10 applied, extras dropped). Created if they don't exist."),
};

export const McpAddQuestionSchema = z.object(McpAddQuestionInputShape);
export type McpAddQuestionInput = z.infer<typeof McpAddQuestionSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpSaveMatchResultInputShape = {
  jobId: z.string().min(1).describe("The id of the job returned by add_job."),
  resumeId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The id of the resume this match was scored against, exactly as given " +
        "in the add_job directive. Omit only if the directive had none.",
    ),
  matchText: z.string().min(20).describe(
    "Your full match analysis: a leading 'SCORES: match=<0-100> " +
      "recommendation=<strong|good|partial|weak>' line, then a markdown body.",
  ),
};

export const McpSaveMatchResultSchema = z.object(McpSaveMatchResultInputShape);
export type McpSaveMatchResultInput = z.infer<typeof McpSaveMatchResultSchema>;

// --- AJS tools (docs/design.md, docs/adr/0005-data-contract.md) ---

// Raw input shape for MCP tool registration (no transforms — SDK uses this for JSON schema)
export const McpUpdateEvaluationInputShape = {
  jobId: z.string().min(1).describe("The id of the job this evaluation belongs to."),
  score: z
    .number()
    .min(1)
    .max(5)
    .describe("Overall fit score from 1.0 to 5.0 (LLM 评分契约); stored ×20 as matchScore 0–100."),
  evaluationReport: z
    .string()
    .min(1)
    .describe("The full evaluation report in markdown: dimensions, evidence, and recommendation."),
  matchData: z
    .string()
    .min(2)
    .describe("JSON string of the raw scoring output: score, dimensions, legality, missingInfo."),
};

export const McpUpdateEvaluationSchema = z.object(McpUpdateEvaluationInputShape);
export type McpUpdateEvaluationInput = z.infer<typeof McpUpdateEvaluationSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpSetStatusInputShape = {
  jobId: z.string().min(1).describe("The id of the job whose status changes."),
  status: z
    .string()
    .min(1)
    .describe("Status name exactly as it exists in the kanban, e.g. '已批准', '待确认', '已回复', 'Applied'."),
};

export const McpSetStatusSchema = z.object(McpSetStatusInputShape);
export type McpSetStatusInput = z.infer<typeof McpSetStatusSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpSaveResumeVersionInputShape = {
  jobId: z
    .string()
    .min(1)
    .describe("The id of the job this tailored resume is for. The resume is named 'Boss-<公司>-<岗位>-vN' and linked to the job."),
};

export const McpSaveResumeVersionSchema = z.object(McpSaveResumeVersionInputShape);
export type McpSaveResumeVersionInput = z.infer<typeof McpSaveResumeVersionSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpAddNoteInputShape = {
  jobId: z.string().min(1).describe("The id of the job to attach the note to."),
  content: z
    .string()
    .min(1)
    .describe("Note text — the carrier for the greeting sent or the HR reply原文."),
};

export const McpAddNoteSchema = z.object(McpAddNoteInputShape);
export type McpAddNoteInput = z.infer<typeof McpAddNoteSchema>;

// Raw input shape for MCP tool registration (no transforms — SDK uses this for JSON schema)
export const McpListJobsInputShape = {
  status: z
    .string()
    .optional()
    .describe("Filter by status name exactly as in the kanban, e.g. '已批准', '待确认', 'Applied'."),
  minMatchScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Only jobs with matchScore >= this value (0–100 scale)."),
  since: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe("Only jobs created (入库) at or after this ISO-8601 datetime."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Max jobs to return (default 20, hard cap 50). Newest first."),
};

// Full schema with transforms for parsing raw MCP input in the handler
export const McpListJobsSchema = z.object({
  ...McpListJobsInputShape,
  since: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});
export type McpListJobsInput = z.infer<typeof McpListJobsSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpGetJobInputShape = {
  jobId: z.string().min(1).describe("The id of the job to fetch."),
};

export const McpGetJobSchema = z.object(McpGetJobInputShape);
export type McpGetJobInput = z.infer<typeof McpGetJobSchema>;

// Raw input shape for MCP tool registration (no transforms needed)
export const McpAddHrReplyInputShape = {
  jobId: z.string().min(1).describe("The id of the job this HR reply belongs to."),
  content: z
    .string()
    .min(1)
    .describe("HR 回复原文(存 Note,只读存档,不改写不总结)."),
  repliedAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe("HR 回复时间(ISO-8601);缺省为服务器当前时间."),
};

export const McpAddHrReplySchema = z.object({
  ...McpAddHrReplyInputShape,
  repliedAt: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});
export type McpAddHrReplyInput = z.infer<typeof McpAddHrReplySchema>;
