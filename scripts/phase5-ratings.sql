-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Phase 5: Driver Ratings
-- Run AFTER setup.sql in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- Add rating columns to Driver (nullable avg, count defaults 0)
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "ratingAvg"   FLOAT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- ── DriverRating table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DriverRating" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "driverId"  TEXT         NOT NULL,
  "parentId"  TEXT         NOT NULL,
  "score"     INTEGER      NOT NULL,
  "comment"   TEXT,
  "isHidden"  BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverRating_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "DriverRating_score_check"         CHECK ("score" >= 1 AND "score" <= 5),
  CONSTRAINT "DriverRating_driverId_parentId_key" UNIQUE ("driverId", "parentId"),
  CONSTRAINT "DriverRating_driverId_fkey"       FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DriverRating_parentId_fkey"       FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DriverRating_driverId_idx" ON "DriverRating"("driverId");
CREATE INDEX IF NOT EXISTS "DriverRating_parentId_idx" ON "DriverRating"("parentId");

-- Auto-updatedAt trigger (matches pattern used in reports-schema.sql / setup.sql)
DROP TRIGGER IF EXISTS trg_driver_rating_updated_at ON "DriverRating";
CREATE TRIGGER trg_driver_rating_updated_at
  BEFORE UPDATE ON "DriverRating"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Secure the table on creation (policies live in rls-policies.sql).
ALTER TABLE "DriverRating" ENABLE ROW LEVEL SECURITY;
