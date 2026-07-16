-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Driver Onboarding Session table
-- Run AFTER setup.sql in Supabase SQL Editor
-- Paste into Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────

-- DriverOnboardingSession: tracks a driver's progress through the
-- WhatsApp-based onboarding conversation (see lib/whatsapp/driverOnboardingFlow.ts)
CREATE TABLE IF NOT EXISTS "DriverOnboardingSession" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "phone"          TEXT         NOT NULL,
  "userId"         TEXT,
  "currentStep"    TEXT         NOT NULL DEFAULT 'DETAILS',
  -- DETAILS | VEHICLE | ASSOCIATION | BANKING | COMPLIANCE_DOCS | DONE
  "collectedData"  JSONB        NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverOnboardingSession_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "DriverOnboardingSession_phone_key"    UNIQUE ("phone"),
  CONSTRAINT "DriverOnboardingSession_userId_fkey"  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DriverOnboardingSession_userId_idx" ON "DriverOnboardingSession"("userId");

-- Auto-updatedAt trigger (matches pattern used in setup.sql / reports-schema.sql)
CREATE TRIGGER trg_driveronboardingsession_updated_at
  BEFORE UPDATE ON "DriverOnboardingSession"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──
ALTER TABLE "DriverOnboardingSession" ENABLE ROW LEVEL SECURITY;

-- Once linked to a User, that user can read their own session
-- (matches the "Drivers can read own" pattern on the Driver table).
-- Before linking (userId still NULL), only the service role (which
-- bypasses RLS) can read/write — the WhatsApp webhook route uses it.
DROP POLICY IF EXISTS "DriverOnboardingSession_own_read" ON "DriverOnboardingSession";
CREATE POLICY "DriverOnboardingSession_own_read" ON "DriverOnboardingSession"
  FOR SELECT USING ("userId" = auth_user_id());
