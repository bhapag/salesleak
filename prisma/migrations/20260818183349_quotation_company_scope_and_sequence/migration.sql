-- Hand-authored (not `prisma migrate dev`) to safely add a required column
-- to a populated table. Sequence: nullable -> backfill -> verify -> NOT NULL
-- -> FK/index -> unique constraint. Each verification step aborts the whole
-- migration (transactional) rather than leaving the schema half-migrated.

-- Step 1: add companyId as nullable so the ALTER succeeds on existing rows
ALTER TABLE "Quotation" ADD COLUMN "companyId" TEXT;

-- Step 2: backfill from the existing Lead relationship (the only source of
-- truth for a Quotation's tenant today)
UPDATE "Quotation" AS q
SET "companyId" = l."companyId"
FROM "Lead" AS l
WHERE l."id" = q."leadId";

-- Step 3: safety net — abort if any row failed to backfill (e.g. an orphaned
-- leadId), rather than silently proceeding to a NOT NULL that would fail
-- anyway with a less clear error
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM "Quotation" WHERE "companyId" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Quotation.companyId backfill incomplete: % row(s) have no companyId', missing_count;
  END IF;
END $$;

-- Step 4: now safe to require it going forward
ALTER TABLE "Quotation" ALTER COLUMN "companyId" SET NOT NULL;

-- Step 5: FK + index, matching the convention already used by every other
-- tenant-scoped model in this schema (e.g. Lead, Customer, Product)
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Quotation_companyId_idx" ON "Quotation"("companyId");

-- Step 6: safety net — abort if any (companyId, quotationNumber) duplicate
-- exists, rather than letting CREATE UNIQUE INDEX fail with a raw Postgres
-- error mid-migration
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT "companyId", "quotationNumber" FROM "Quotation"
    GROUP BY "companyId", "quotationNumber"
    HAVING COUNT(*) > 1
  ) AS dupes;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot add per-company uniqueness: % duplicate (companyId, quotationNumber) pair(s) found', dup_count;
  END IF;
END $$;

-- Step 7: the core integrity invariant this patch exists to add — unique
-- WITHIN a company, different companies MAY reuse the same number
CREATE UNIQUE INDEX "Quotation_companyId_quotationNumber_key" ON "Quotation"("companyId", "quotationNumber");

-- Step 8: company-level monotonic counter backing atomic, race-safe number
-- generation (replaces the old count()-based suggestion, which two
-- concurrent requests could read identically and race on)
ALTER TABLE "Company" ADD COLUMN "lastQuotationSequence" INTEGER NOT NULL DEFAULT 0;

-- Step 9: backfill the counter from each company's current quotation count,
-- so the first number suggested after this migration continues counting
-- from where the old count()-based logic left off rather than restarting
UPDATE "Company" AS c
SET "lastQuotationSequence" = sub.cnt
FROM (
  SELECT "companyId", COUNT(*) AS cnt FROM "Quotation" GROUP BY "companyId"
) AS sub
WHERE c."id" = sub."companyId";
