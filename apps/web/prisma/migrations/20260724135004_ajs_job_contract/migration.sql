-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "jobUrl" TEXT,
    "description" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "workplaceType" TEXT,
    "createdAt" DATETIME NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedDate" DATETIME,
    "dueDate" DATETIME,
    "statusId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobSourceId" TEXT,
    "salaryRange" TEXT,
    "locationId" TEXT,
    "resumeId" TEXT,
    "coverLetterId" TEXT,
    "automationId" TEXT,
    "matchScore" INTEGER,
    "matchData" TEXT,
    "discoveryStatus" TEXT,
    "discoveredAt" DATETIME,
    "createdVia" TEXT,
    "evaluationReport" TEXT,
    "weekendRestStatus" TEXT NOT NULL DEFAULT 'none',
    "holidayStatus" TEXT NOT NULL DEFAULT 'none',
    "greetingSentAt" DATETIME,
    "hrReplyAt" DATETIME,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "JobStatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_jobSourceId_fkey" FOREIGN KEY ("jobSourceId") REFERENCES "JobSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "CoverLetter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applied", "appliedDate", "automationId", "companyId", "coverLetterId", "createdAt", "createdVia", "description", "discoveredAt", "discoveryStatus", "dueDate", "id", "jobSourceId", "jobTitleId", "jobType", "jobUrl", "locationId", "matchData", "matchScore", "resumeId", "salaryRange", "statusId", "userId", "workplaceType") SELECT "applied", "appliedDate", "automationId", "companyId", "coverLetterId", "createdAt", "createdVia", "description", "discoveredAt", "discoveryStatus", "dueDate", "id", "jobSourceId", "jobTitleId", "jobType", "jobUrl", "locationId", "matchData", "matchScore", "resumeId", "salaryRange", "statusId", "userId", "workplaceType" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_userId_automationId_idx" ON "Job"("userId", "automationId");
CREATE INDEX "Job_userId_discoveryStatus_idx" ON "Job"("userId", "discoveryStatus");

-- SQLite table rebuild above drops indexes not present in the Prisma schema,
-- so re-create the hand-written partial unique index from
-- 20260710000002_job_automation_url_unique.
CREATE UNIQUE INDEX "Job_userId_jobUrl_automation_key"
ON "Job"("userId", "jobUrl")
WHERE "automationId" IS NOT NULL;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
