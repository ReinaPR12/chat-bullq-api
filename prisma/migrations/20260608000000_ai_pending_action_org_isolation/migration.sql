-- Bug #3 (HIGH): tenant isolation for ai_pending_actions at the data layer.
-- Additive + backfill: add a nullable organization_id, backfill it from the
-- parent conversation, then index it. Kept nullable so the migration is safe
-- to run online; the application populates it on every new create().

-- 1) Nullable column (additive, no rewrite-locking default).
ALTER TABLE "ai_pending_actions"
  ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- 2) Backfill org from the owning conversation (per-tenant, idempotent).
UPDATE "ai_pending_actions" AS pa
SET "organization_id" = c."organization_id"
FROM "conversations" AS c
WHERE pa."conversation_id" = c."id"
  AND pa."organization_id" IS NULL;

-- 3) FK to organizations (cascade delete), guarded so re-runs don't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_pending_actions_organization_id_fkey'
  ) THEN
    ALTER TABLE "ai_pending_actions"
      ADD CONSTRAINT "ai_pending_actions_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Index for org-scoped status queries (matches @@index org_status).
CREATE INDEX IF NOT EXISTS "idx_ai_pending_org_status"
  ON "ai_pending_actions" ("organization_id", "status");
