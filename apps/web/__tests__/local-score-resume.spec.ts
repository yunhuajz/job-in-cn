import { describe, it, expect, vi } from "vitest";
import { extractResumeFileText } from "@/lib/jobs/extractResumeFileText";
import fs from "fs";

describe("local score resume file fallback", () => {
  it("extracts text when file exists on disk", async () => {
    const samplePath = "D:\\data\\files\\resumes\\刘玉浩-简历_2026-09-08T06-58-49.pdf";
    if (fs.existsSync(samplePath)) {
      const text = await extractResumeFileText(samplePath);
      expect(text).not.toBeNull();
      expect(text!.length).toBeGreaterThan(200);
      expect(text).toContain("刘玉浩");
    }
  });

  it("returns null safely when file does not exist", async () => {
    const text = await extractResumeFileText("non-existent-file.pdf");
    expect(text).toBeNull();
  });
});
