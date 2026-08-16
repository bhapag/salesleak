-- CreateTable
CREATE TABLE "FailedIngestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "normalizedPayload" TEXT,
    "errorMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedLeadId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FailedIngestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT,
    "webhookToken" TEXT,
    "signingSecret" TEXT,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Integration" ("companyId", "config", "createdAt", "enabled", "id", "lastError", "lastSuccessAt", "lastSyncAt", "status", "type", "updatedAt") SELECT "companyId", "config", "createdAt", "enabled", "id", "lastError", "lastSuccessAt", "lastSyncAt", "status", "type", "updatedAt" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
CREATE UNIQUE INDEX "Integration_webhookToken_key" ON "Integration"("webhookToken");
CREATE INDEX "Integration_companyId_idx" ON "Integration"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FailedIngestion_companyId_idx" ON "FailedIngestion"("companyId");

-- CreateIndex
CREATE INDEX "FailedIngestion_status_idx" ON "FailedIngestion"("status");
