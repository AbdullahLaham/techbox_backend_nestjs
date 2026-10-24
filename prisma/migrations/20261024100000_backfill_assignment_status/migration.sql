-- Backfill (ASSIGNMENTS_SPEC.md 3.3): `status` defaults to DRAFT, which would hide
-- every existing assignment from students. Publish them, using createdAt as the
-- publish date so they do not all show up as "new".
UPDATE "Assignment"
SET "status" = 'PUBLISHED', "publishedAt" = "createdAt"
WHERE "status" = 'DRAFT' AND "publishedAt" IS NULL;
