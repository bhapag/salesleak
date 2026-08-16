-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "triggeredById" TEXT,
    "fileName" TEXT,
    "recordsReceived" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IngestionBatch_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngestionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalLeadId" TEXT,
    "customerName" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "state" TEXT,
    "requirement" TEXT,
    "product" TEXT,
    "quantity" TEXT,
    "estimatedValue" REAL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IngestionRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IngestionRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IngestionRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "lastSyncAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Integration" ("companyId", "config", "createdAt", "id", "status", "type", "updatedAt") SELECT "companyId", "config", "createdAt", "id", "status", "type", "updatedAt" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
CREATE INDEX "Integration_companyId_idx" ON "Integration"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "IngestionBatch_companyId_idx" ON "IngestionBatch"("companyId");

-- CreateIndex
CREATE INDEX "IngestionRecord_batchId_idx" ON "IngestionRecord"("batchId");

-- CreateIndex
CREATE INDEX "IngestionRecord_companyId_idx" ON "IngestionRecord"("companyId");

-- CreateIndex
CREATE INDEX "IngestionRecord_source_externalLeadId_idx" ON "IngestionRecord"("source", "externalLeadId");
