-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Row Level Security (RLS) Policies
-- Run this AFTER setup.sql and supabase-trip-schema.sql
-- Paste into Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────
-- NOTE: The API uses SERVICE_ROLE_KEY which bypasses RLS.
-- These policies protect the tables when accessed via the
-- anon/public key (e.g. from client-side Supabase calls).

-- Enable RLS on all tables
ALTER TABLE "User"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OtpToken"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Driver"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Parent"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Child"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceDocument"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Association"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformConfig"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildSchedule"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleOverride"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripStop"            ENABLE ROW LEVEL SECURITY;

-- Helper: get the user's role from their JWT
CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'ANON'
  );
$$ LANGUAGE SQL STABLE;

-- Helper: get the user's id from their JWT
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  );
$$ LANGUAGE SQL STABLE;

-- ── User ──
DROP POLICY IF EXISTS "Users can read own record" ON "User";
CREATE POLICY "Users can read own record" ON "User"
  FOR SELECT USING ("id" = auth_user_id() OR auth_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "Users can update own record" ON "User";
CREATE POLICY "Users can update own record" ON "User"
  FOR UPDATE USING ("id" = auth_user_id());

-- ── Driver ──
DROP POLICY IF EXISTS "Drivers can read own" ON "Driver";
CREATE POLICY "Drivers can read own" ON "Driver"
  FOR SELECT USING ("userId" = auth_user_id());
DROP POLICY IF EXISTS "Drivers can update own" ON "Driver";
CREATE POLICY "Drivers can update own" ON "Driver"
  FOR UPDATE USING ("userId" = auth_user_id());
DROP POLICY IF EXISTS "Parents can read active drivers" ON "Driver";
CREATE POLICY "Parents can read active drivers" ON "Driver"
  FOR SELECT USING (
    auth_user_role() = 'PARENT'
    AND "status" IN ('ACTIVE', 'PENDING_COMPLIANCE')
  );
DROP POLICY IF EXISTS "Admins can read all drivers" ON "Driver";
CREATE POLICY "Admins can read all drivers" ON "Driver"
  FOR SELECT USING (auth_user_role() = 'ADMIN');

-- ── Parent ──
DROP POLICY IF EXISTS "Parents read own" ON "Parent";
CREATE POLICY "Parents read own" ON "Parent"
  FOR SELECT USING ("userId" = auth_user_id() OR auth_user_role() = 'ADMIN');
DROP POLICY IF EXISTS "Parents update own" ON "Parent";
CREATE POLICY "Parents update own" ON "Parent"
  FOR UPDATE USING ("userId" = auth_user_id());

-- ── Child ──
DROP POLICY IF EXISTS "Parents read own children" ON "Child";
CREATE POLICY "Parents read own children" ON "Child"
  FOR SELECT USING (
    "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "Parents update own children" ON "Child";
CREATE POLICY "Parents update own children" ON "Child"
  FOR UPDATE USING (
    "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id())
  );
DROP POLICY IF EXISTS "Parents insert children" ON "Child";
CREATE POLICY "Parents insert children" ON "Child"
  FOR INSERT WITH CHECK (
    "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id())
  );
DROP POLICY IF EXISTS "Drivers read assigned children" ON "Child";
CREATE POLICY "Drivers read assigned children" ON "Child"
  FOR SELECT USING (
    "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id())
  );

-- ── Contract ──
DROP POLICY IF EXISTS "Contract read own" ON "Contract";
CREATE POLICY "Contract read own" ON "Contract"
  FOR SELECT USING (
    "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id())
    OR "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );

-- ── ComplianceDocument ──
DROP POLICY IF EXISTS "Compliance read own" ON "ComplianceDocument";
CREATE POLICY "Compliance read own" ON "ComplianceDocument"
  FOR SELECT USING (
    "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "Compliance admin update" ON "ComplianceDocument";
CREATE POLICY "Compliance admin update" ON "ComplianceDocument"
  FOR UPDATE USING (auth_user_role() = 'ADMIN');

-- ── ChildSchedule ──
DROP POLICY IF EXISTS "Schedule parent access" ON "ChildSchedule";
CREATE POLICY "Schedule parent access" ON "ChildSchedule"
  FOR ALL USING (
    "childId" IN (SELECT "id" FROM "Child" WHERE "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()))
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "Schedule driver read" ON "ChildSchedule";
CREATE POLICY "Schedule driver read" ON "ChildSchedule"
  FOR SELECT USING (
    "childId" IN (SELECT "id" FROM "Child" WHERE "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()))
  );

-- ── ScheduleOverride ──
DROP POLICY IF EXISTS "Override parent access" ON "ScheduleOverride";
CREATE POLICY "Override parent access" ON "ScheduleOverride"
  FOR ALL USING (
    "childId" IN (SELECT "id" FROM "Child" WHERE "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id()))
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "Override driver read" ON "ScheduleOverride";
CREATE POLICY "Override driver read" ON "ScheduleOverride"
  FOR SELECT USING (
    "childId" IN (SELECT "id" FROM "Child" WHERE "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()))
  );

-- ── Trip ──
DROP POLICY IF EXISTS "Trip driver access" ON "Trip";
CREATE POLICY "Trip driver access" ON "Trip"
  FOR ALL USING (
    "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "Trip parent read" ON "Trip";
CREATE POLICY "Trip parent read" ON "Trip"
  FOR SELECT USING (
    "id" IN (
      SELECT ts."tripId" FROM "TripStop" ts
      JOIN "Child" c ON c."id" = ts."childId"
      JOIN "Parent" p ON p."id" = c."parentId"
      WHERE p."userId" = auth_user_id()
    )
  );

-- ── TripStop ──
DROP POLICY IF EXISTS "TripStop driver access" ON "TripStop";
CREATE POLICY "TripStop driver access" ON "TripStop"
  FOR ALL USING (
    "tripId" IN (SELECT "id" FROM "Trip" WHERE "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id()))
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "TripStop parent read" ON "TripStop";
CREATE POLICY "TripStop parent read" ON "TripStop"
  FOR SELECT USING (
    "tripId" IN (
      SELECT t."id" FROM "Trip" t
      JOIN "TripStop" ts2 ON ts2."tripId" = t."id"
      JOIN "Child" c ON c."id" = ts2."childId"
      JOIN "Parent" p ON p."id" = c."parentId"
      WHERE p."userId" = auth_user_id()
    )
  );

-- ── Transaction / Payout ──
DROP POLICY IF EXISTS "Transaction parent read" ON "Transaction";
CREATE POLICY "Transaction parent read" ON "Transaction"
  FOR SELECT USING (
    "parentId" IN (SELECT "id" FROM "Parent" WHERE "userId" = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
DROP POLICY IF EXISTS "Payout driver read" ON "Payout";
CREATE POLICY "Payout driver read" ON "Payout"
  FOR SELECT USING (
    "driverId" IN (SELECT "id" FROM "Driver" WHERE "userId" = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );

-- ── Association ──
DROP POLICY IF EXISTS "Association public read" ON "Association";
CREATE POLICY "Association public read" ON "Association"
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Association admin write" ON "Association";
CREATE POLICY "Association admin write" ON "Association"
  FOR ALL USING (auth_user_role() = 'ADMIN');
