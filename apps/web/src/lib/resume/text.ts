import "server-only";

import fs from "fs";
import path from "path";
import { extractText } from "@/lib/ai/import/extract-text";

export async function extractResumeFileText(
  filePath?: string | null,
): Promise<string | null> {
  if (!filePath) return null;
  try {
    const cwd = process.cwd();
    const cleanPath = filePath.replace(/^[\\\/]+/, "");
    const rootDir = path.parse(cwd).root;

    const candidates = [
      filePath,
      path.resolve(cwd, cleanPath),
      path.resolve(cwd, filePath),
      path.resolve(rootDir, cleanPath),
      path.resolve(rootDir, "data", "files", "resumes", path.basename(filePath)),
      path.resolve(cwd, "data", "files", "resumes", path.basename(filePath)),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const buf = fs.readFileSync(candidate);
        const result = await extractText(buf);
        if (result.success && result.data.text.trim()) {
          return result.data.text.trim();
        }
      }
    }
  } catch (err) {
    console.warn("Failed to extract resume file text fallback:", err);
  }
  return null;
}
