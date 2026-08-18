-- Data-only correction: Company.lastQuotationSequence was originally
-- backfilled from each company's quotation COUNT (see migration
-- 20260818183349), not from the highest existing QT-YYYY-#### number. A
-- company whose historical numbers are sparse/high (e.g. seed data with
-- arbitrary numbers up to QT-2026-0047 but only 19 rows) ends up with a
-- counter below its own history, so early auto-suggestions collide with
-- real historical numbers until the counter climbs past them. The DB's
-- @@unique constraint already blocks any actual duplicate row — this only
-- fixes the redundant collisions themselves.
--
-- Only numbers matching the exact auto-generated format (QT-YYYY-####) are
-- considered "sequence" values. Custom/manual numbers in any other shape
-- (e.g. "OMP-2025-0031") are never touched or interpreted as a sequence.
-- No Quotation row or quotationNumber value is modified by this migration.

UPDATE "Company" AS c
SET "lastQuotationSequence" = sub.max_seq
FROM (
  SELECT "companyId", MAX(CAST(substring("quotationNumber" FROM '^QT-[0-9]{4}-([0-9]+)$') AS INTEGER)) AS max_seq
  FROM "Quotation"
  WHERE "quotationNumber" ~ '^QT-[0-9]{4}-[0-9]+$'
  GROUP BY "companyId"
) AS sub
WHERE c."id" = sub."companyId"
  AND sub.max_seq > c."lastQuotationSequence";
