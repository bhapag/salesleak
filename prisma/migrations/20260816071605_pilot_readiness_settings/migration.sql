-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "industry" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "onboardedAt" DATETIME,
    "highValueThreshold" REAL NOT NULL DEFAULT 50000,
    "staleQuotationDays" INTEGER NOT NULL DEFAULT 10,
    "defaultFollowUpDays" INTEGER NOT NULL DEFAULT 3,
    "defaultPriority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "lostReasonPresets" TEXT,
    "activeLeadSources" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Company" ("city", "createdAt", "currency", "email", "id", "industry", "name", "phone", "state", "timezone", "updatedAt") SELECT "city", "createdAt", "currency", "email", "id", "industry", "name", "phone", "state", "timezone", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
