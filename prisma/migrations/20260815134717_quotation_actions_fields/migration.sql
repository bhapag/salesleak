-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "lostAt" DATETIME;
ALTER TABLE "Quotation" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "nextAction" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "wonAt" DATETIME;
