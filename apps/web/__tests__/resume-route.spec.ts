import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
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

  it("returns attachment with RFC 5987 UTF-8 encoded filename for PDF download", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const chineseFileName = "刘玉浩-简历.pdf";
    const testPdfPath = path.join(tempDir, chineseFileName);
    fs.writeFileSync(testPdfPath, "%PDF-1.4 dummy pdf content");

    const req = new NextRequest(
      `http://localhost:3737/api/profile/resume?filePath=${encodeURIComponent(testPdfPath)}`,
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

    const req = new NextRequest(
      `http://localhost:3737/api/profile/resume?filePath=${encodeURIComponent(testPdfPath)}&mode=preview`,
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

    const req = new NextRequest(
      `http://localhost:3737/api/profile/resume?filePath=${encodeURIComponent(docxPath)}&mode=preview`,
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

    const req = new NextRequest(
      `http://localhost:3737/api/profile/resume?filePath=${encodeURIComponent(docxPath)}&mode=preview`,
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(422);
    const data = await res!.json();
    expect(data.error).toBe("无法预览这份 Word 简历");
  });

  it("returns 401 when user is not authenticated", async () => {
    (auth as any).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost:3737/api/profile/resume?filePath=any-path.pdf",
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(401);
  });

  it("returns 400 when filePath is missing", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const req = new NextRequest("http://localhost:3737/api/profile/resume");

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(400);
    const data = await res!.json();
    expect(data.error).toBe("File path is required");
  });

  it("returns 404 when file does not exist", async () => {
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const nonExistentPath = path.join(tempDir, "不存在的简历.pdf");
    const req = new NextRequest(
      `http://localhost:3737/api/profile/resume?filePath=${encodeURIComponent(nonExistentPath)}`,
    );

    const res = await GET(req);
    expect(res).toBeDefined();
    expect(res!.status).toBe(404);
    const data = await res!.json();
    expect(data.error).toBe("File not found");
  });
});
