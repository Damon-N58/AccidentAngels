-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Report table
-- Run this AFTER setup.sql in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- Report table for parent safety reports on drivers/vehicles
CREATE TABLE IF NOT EXISTS "Report" (
  "id"                TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "parentId"          TEXT         NOT NULL,
  "driverId"          TEXT         NOT NULL,
  "childId"           TEXT,
  "category"          TEXT         NOT NULL, -- UNSAFE_VEHICLE | UNSAFE_BEHAVIOUR | OTHER
  "description"       TEXT         NOT NULL,
  "status"            TEXT         NOT NULL DEFAULT 'OPEN', -- OPEN | UNDER_REVIEW | RESOLVED | DISMISSED
  "adminNotes"        TEXT,
  "resolvedAt"        TIMESTAMP(3),
  "resolvedByUserId"  TEXT,
  "driverNotifiedAt"  TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Report_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "Report_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Report_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx" ON "Report"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Report_driverId_idx"         ON "Report"("driverId");
CREATE INDEX IF NOT EXISTS "Report_parentId_idx"         ON "Report"("parentId");

-- Auto-updatedAt trigger (matches pattern used in setup.sql)
CREATE TRIGGER trg_report_updated_at
  BEFORE UPDATE ON "Report"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;

-- Parents can file reports
DROP POLICY IF EXISTS "Report_parent_insert" ON "Report";
CREATE POLICY "Report_parent_insert" ON "Report"
  FOR INSERT WITH CHECK (
    "parentId" IN (
      SELECT "id" FROM "Parent" WHERE "userId" = auth.uid()::text
    )
  );

-- Parents can read only their own reports
DROP POLICY IF EXISTS "Report_parent_select" ON "Report";
CREATE POLICY "Report_parent_select" ON "Report"
  FOR SELECT USING (
    "parentId" IN (
      SELECT "id" FROM "Parent" WHERE "userId" = auth.uid()::text
    )
  );

-- Drivers have NO access to report content (zero rows returned — no driver policy defined)
-- Admin access is handled via service role key which bypasses RLS
