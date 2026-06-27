-- ── Phase 3: Waiting Time Charges ──
-- Run AFTER supabase-trip-schema.sql in Supabase SQL Editor.

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
  CONSTRAINT "WaitingCharge_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitingCharge_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WaitingCharge_parentId_billedAt_idx" ON "WaitingCharge"("parentId", "billedAt");
CREATE INDEX IF NOT EXISTS "WaitingCharge_tripId_idx" ON "WaitingCharge"("tripId");
