import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    resume: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/import/extract-text", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/import/extract-text")>();
  return {
    ...actual,
    extractText: vi.fn(),
  };
});

import { GET } from "@/app/api/profile/resume/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { extractText } from "@/lib/ai/import/extract-text";

describe("GET /api/profile/resume", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jbcn-resume-test-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns attachment with RFC 5987 UTF-8 encoded filename for PDF download by resumeId", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const chineseFileName = "刘玉浩-简历.pdf";
    const testPdfPath = path.join(tempDir, chineseFileName);
    fs.writeFileSync(testPdfPath, "%PDF-1.4 dummy pdf content");

    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "res-1",
      profile: { userId: "user-1" },
      File: { filePath: testPdfPath, fileName: chineseFileName },
    });

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-1",
    );

    const res = await GET(req);
    expect(res).toBeDefined();

    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toBe("application/pdf");

    const disposition = res!.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename*=");
    expect(disposition).toContain(encodeURIComponent(chineseFileName));

    // Ensure no non-ASCII character in header value (RFC 5987 / ByteString safe)
    expect(/^[\x20-\x7E;=_\-.'%"\s]+$/.test(disposition!)).toBe(true);
  });

  it("returns inline Content-Disposition when mode=preview for PDF files", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const chineseFileName = "刘玉浩-简历.pdf";
    const testPdfPath = path.join(tempDir, chineseFileName);
    fs.writeFileSync(testPdfPath, "%PDF-1.4 dummy pdf content");

    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "res-pdf-preview",
      profile: { userId: "user-1" },
      File: { filePath: testPdfPath, fileName: chineseFileName },
    });

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-pdf-preview&mode=preview",
    );

    const res = await GET(req);
    expect(res).toBeDefined();

    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toBe("application/pdf");

    const disposition = res!.headers.get("Content-Disposition");
    expect(disposition).toContain("inline");
    expect(disposition).toContain("filename*=");
    expect(disposition).toContain(encodeURIComponent(chineseFileName));
    expect(/^[\x20-\x7E;=_\-.'%"\s]+$/.test(disposition!)).toBe(true);
  });

  it("extracts and returns plain text when mode=preview for Word files", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });
    (extractText as any).mockResolvedValue({
      success: true,
      data: { text: "这是 Word 简历提取的正文内容" },
    });

    const docxPath = path.join(tempDir, "测试简历.docx");
    fs.writeFileSync(docxPath, "dummy docx content");

    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "res-docx",
      profile: { userId: "user-1" },
      File: { filePath: docxPath, fileName: "测试简历.docx" },
    });

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-docx&mode=preview",
    );

    const res = await GET(req);
    expect(res).toBeDefined();

    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    const text = await res!.text();
    expect(text).toBe("这是 Word 简历提取的正文内容");
  });

  it("returns 422 when Word preview text extraction fails", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });
    (extractText as any).mockResolvedValue({
      success: false,
      error: { code: "EXTRACTION_FAILED", message: "fail" },
    });

    const docxPath = path.join(tempDir, "损坏简历.docx");
    fs.writeFileSync(docxPath, "corrupt content");

    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "res-corrupt",
      profile: { userId: "user-1" },
      File: { filePath: docxPath, fileName: "损坏简历.docx" },
    });

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-corrupt&mode=preview",
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(422);
    const data = await res!.json();
    expect(data.error).toBe("无法预览这份 Word 简历");
  });

  it("returns 403 when user attempts to access another user's resume", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-attacker" } });

    const testPdfPath = path.join(tempDir, "他人简历.pdf");
    fs.writeFileSync(testPdfPath, "%PDF-1.4 victim resume");

    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "res-victim",
      profile: { userId: "user-victim" },
      File: { filePath: testPdfPath, fileName: "他人简历.pdf" },
    });

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-victim",
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(403);
    const data = await res!.json();
    expect(data.error).toBe("Forbidden");
  });

  it("returns 401 when user is not authenticated", async () => {
    (auth as any).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-1",
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(401);
  });

  it("returns 400 when resumeId is missing", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const req = new NextRequest("http://localhost:3737/api/profile/resume");

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(400);
    const data = await res!.json();
    expect(data.error).toBe("Resume ID is required");
  });

  it("returns 404 when resume is not found in database", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });
    (prisma.resume.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=non-existent-id",
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(404);
    const data = await res!.json();
    expect(data.error).toBe("Resume or file not found");
  });

  it("returns 404 when file does not exist on disk", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const nonExistentPath = path.join(tempDir, "磁盘上不存在.pdf");
    (prisma.resume.findUnique as any).mockResolvedValue({
      id: "res-missing-file",
      profile: { userId: "user-1" },
      File: { filePath: nonExistentPath, fileName: "磁盘上不存在.pdf" },
    });

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?resumeId=res-missing-file",
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(404);
    const data = await res!.json();
    expect(data.error).toBe("File not found on disk");
  });
});
