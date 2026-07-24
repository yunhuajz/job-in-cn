import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Spins up a real SQLite test DB by deploying the committed migrations to a
// throwaway file under prisma/, so schema contracts are tested against the
// actual migration history instead of a mock.
export function createAjsTestDb(name: string) {
  const fileName = `.test-${name}.db`;
  const url = `file:./${fileName}`;
  const appRoot = path.resolve(__dirname, "..", "..");
  const dbPath = path.join(appRoot, "prisma", fileName);

  fs.rmSync(dbPath, { force: true });

  const prismaCli = path.join(appRoot, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: path.join(appRoot, "prisma"),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      fs.rmSync(dbPath, { force: true });
    },
  };
}
