CREATE TABLE "JobCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobCollection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "JobCollection" ("id", "jobId", "collectedAt")
SELECT lower(hex(randomblob(16))), "id", "createdAt"
FROM "Job";

CREATE INDEX "JobCollection_jobId_collectedAt_idx" ON "JobCollection"("jobId", "collectedAt");
CREATE INDEX "JobCollection_collectedAt_idx" ON "JobCollection"("collectedAt");
