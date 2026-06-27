-- ═════════════════════════════════════════════════════════════
-- Accident Angels — CONSOLIDATED MIGRATION for Phases 3, 4, 5
-- Run ONCE in the Supabase SQL Editor (paste all, click Run).
-- Safe to re-run: all statements use IF NOT EXISTS / DROP ... IF EXISTS.
-- Phase 4 (route map) needs NO schema — it only reads existing tables.
-- ═════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- PHASE 3 — Waiting Time Charges
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "TripStop" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3);
ALTER TABLE "TripStop" ADD COLUMN IF NOT EXISTS "waitingChargeCents" INTEGER;

CREATE TABLE IF NOT EXISTS "WaitingCharge" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tripStopId"       TEXT         NOT NULL,
  "tripId"           TEXT         NOT NULL,
  "childId"          TEXT         NOT NULL,
  "parentId"         TEXT         NOT NULL,
  "driverId"         TEXT         NOT NULL,
  "arrivedAt"        TIMESTAMP(3) NOT NULL,
  "completedAt"      TIMESTAMP(3) NOT NULL,
  "waitingSeconds"   INTEGER      NOT NULL,
  "graceSeconds"     INTEGER      NOT NULL DEFAULT 180,
  "billableMinutes"  INTEGER      NOT NULL,
  "chargeCents"      INTEGER      NOT NULL,
  "isLive"           BOOLEAN      NOT NULL DEFAULT false,
  "billedAt"         TIMESTAMP(3),
  "transactionId"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitingCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WaitingCharge_tripStopId_key" UNIQUE ("tripStopId"),
  CONSTRAINT "WaitingCharge_tripStopId_fkey" FOREIGN KEY ("tripStopId") REFERENCES "TripStop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_tripId_fkey"     FOREIGN KEY ("tripId")     REFERENCES "Trip"("id")     ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_childId_fkey"    FOREIGN KEY ("childId")    REFERENCES "Child"("id")    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_parentId_fkey"   FOREIGN KEY ("parentId")   REFERENCES "Parent"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_driverId_fkey"   FOREIGN KEY ("driverId")   REFERENCES "Driver"("id")   ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WaitingCharge_parentId_billedAt_idx" ON "WaitingCharge"("parentId", "billedAt");
CREATE INDEX IF NOT EXISTS "WaitingCharge_tripId_idx" ON "WaitingCharge"("tripId");

ALTER TABLE "WaitingCharge" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WaitingCharge_parent_select" ON "WaitingCharge";
CREATE POLICY "WaitingCharge_parent_select" ON "WaitingCharge"
  FOR SELECT USING ("parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()));

DROP POLICY IF EXISTS "WaitingCharge_driver_select" ON "WaitingCharge";
CREATE POLICY "WaitingCharge_driver_select" ON "WaitingCharge"
  FOR SELECT USING ("driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()));
-- writes are service-role only (no insert/update policy)


-- ─────────────────────────────────────────────────────────────
-- PHASE 5 — Driver Ratings + Recommendation
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "ratingAvg"   FLOAT;
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "DriverRating" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "driverId"  TEXT         NOT NULL,
  "parentId"  TEXT         NOT NULL,
  "score"     INTEGER      NOT NULL,
  "comment"   TEXT,
  "isHidden"  BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverRating_pkey"                  PRIMARY KEY ("id"),
  CONSTRAINT "DriverRating_score_check"           CHECK ("score" >= 1 AND "score" <= 5),
  CONSTRAINT "DriverRating_driverId_parentId_key" UNIQUE ("driverId", "parentId"),
  CONSTRAINT "DriverRating_driverId_fkey"         FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DriverRating_parentId_fkey"         FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DriverRating_driverId_idx" ON "DriverRating"("driverId");
CREATE INDEX IF NOT EXISTS "DriverRating_parentId_idx" ON "DriverRating"("parentId");

DROP TRIGGER IF EXISTS trg_driver_rating_updated_at ON "DriverRating";
CREATE TRIGGER trg_driver_rating_updated_at
  BEFORE UPDATE ON "DriverRating"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "DriverRating" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DriverRating_parent_select" ON "DriverRating";
CREATE POLICY "DriverRating_parent_select" ON "DriverRating"
  FOR SELECT USING ("parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()));

DROP POLICY IF EXISTS "DriverRating_parent_insert" ON "DriverRating";
CREATE POLICY "DriverRating_parent_insert" ON "DriverRating"
  FOR INSERT WITH CHECK ("parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()));

DROP POLICY IF EXISTS "DriverRating_parent_update" ON "DriverRating";
CREATE POLICY "DriverRating_parent_update" ON "DriverRating"
  FOR UPDATE
  USING ("parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()))
  WITH CHECK ("parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()));

DROP POLICY IF EXISTS "DriverRating_driver_select" ON "DriverRating";
CREATE POLICY "DriverRating_driver_select" ON "DriverRating"
  FOR SELECT USING ("driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()));

DROP POLICY IF EXISTS "DriverRating_driver_update" ON "DriverRating";
CREATE POLICY "DriverRating_driver_update" ON "DriverRating"
  FOR UPDATE
  USING ("driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()))
  WITH CHECK ("driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()));

-- ═════════════════════════════════════════════════════════════
-- Done. Phases 3, 4, 5 are now fully provisioned.
-- ═════════════════════════════════════════════════════════════
