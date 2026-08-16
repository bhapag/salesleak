-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "product" TEXT,
    "quantity" TEXT,
    "estimatedValue" REAL,
    "nextAction" TEXT,
    "nextActionDeadline" DATETIME,
    "lostReason" TEXT,
    "wonAt" DATETIME,
    "lostAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("companyId", "createdAt", "customerId", "description", "estimatedValue", "id", "lostAt", "lostReason", "nextAction", "nextActionDeadline", "ownerId", "source", "status", "title", "updatedAt", "wonAt") SELECT "companyId", "createdAt", "customerId", "description", "estimatedValue", "id", "lostAt", "lostReason", "nextAction", "nextActionDeadline", "ownerId", "source", "status", "title", "updatedAt", "wonAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");
CREATE INDEX "Lead_customerId_idx" ON "Lead"("customerId");
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
