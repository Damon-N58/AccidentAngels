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
-- Users can read/update their own record. Admins can read all.
CREATE POLICY "Users can read own record" ON "User"
  FOR SELECT USING (id = auth_user_id() OR auth_user_role() = 'ADMIN');
CREATE POLICY "Users can update own record" ON "User"
  FOR UPDATE USING (id = auth_user_id());

-- ── Driver ──
-- Drivers can read/update their own record. Parents can read active drivers. Admins can read all.
CREATE POLICY "Drivers can read own" ON "Driver"
  FOR SELECT USING (userId = auth_user_id());
CREATE POLICY "Drivers can update own" ON "Driver"
  FOR UPDATE USING (userId = auth_user_id());
CREATE POLICY "Parents can read active drivers" ON "Driver"
  FOR SELECT USING (
    auth_user_role() = 'PARENT'
    AND "status" IN ('ACTIVE', 'PENDING_COMPLIANCE')
  );
CREATE POLICY "Admins can read all drivers" ON "Driver"
  FOR SELECT USING (auth_user_role() = 'ADMIN');

-- ── Parent ──
-- Parents can read/update own record. Admins can read all.
CREATE POLICY "Parents read own" ON "Parent"
  FOR SELECT USING (userId = auth_user_id() OR auth_user_role() = 'ADMIN');
CREATE POLICY "Parents update own" ON "Parent"
  FOR UPDATE USING (userId = auth_user_id());

-- ── Child ──
-- Parents can read their own children. Drivers can read children assigned to them. Admins can read all.
CREATE POLICY "Parents read own children" ON "Child"
  FOR SELECT USING (
    "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "Parents update own children" ON "Child"
  FOR UPDATE USING (
    "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id())
  );
CREATE POLICY "Parents insert children" ON "Child"
  FOR INSERT WITH CHECK (
    "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id())
  );
CREATE POLICY "Drivers read assigned children" ON "Child"
  FOR SELECT USING (
    "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id())
  );

-- ── Contract ──
-- Can read if you're the parent or driver on the contract. Admins can read all.
CREATE POLICY "Contract read own" ON "Contract"
  FOR SELECT USING (
    "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id())
    OR "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );

-- ── ComplianceDocument ──
-- Drivers can read own docs. Admins can read/update all.
CREATE POLICY "Compliance read own" ON "ComplianceDocument"
  FOR SELECT USING (
    "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "Compliance admin update" ON "ComplianceDocument"
  FOR UPDATE USING (auth_user_role() = 'ADMIN');

-- ── ChildSchedule ──
-- Parents of the child can read/write. Drivers assigned to the child can read.
CREATE POLICY "Schedule parent access" ON "ChildSchedule"
  FOR ALL USING (
    "childId" IN (SELECT id FROM "Child" WHERE "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id()))
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "Schedule driver read" ON "ChildSchedule"
  FOR SELECT USING (
    "childId" IN (SELECT id FROM "Child" WHERE "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id()))
  );

-- ── ScheduleOverride ──
CREATE POLICY "Override parent access" ON "ScheduleOverride"
  FOR ALL USING (
    "childId" IN (SELECT id FROM "Child" WHERE "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id()))
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "Override driver read" ON "ScheduleOverride"
  FOR SELECT USING (
    "childId" IN (SELECT id FROM "Child" WHERE "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id()))
  );

-- ── Trip ──
-- Drivers can read/update their own trips. Parents can read trips for their children.
CREATE POLICY "Trip driver access" ON "Trip"
  FOR ALL USING (
    "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "Trip parent read" ON "Trip"
  FOR SELECT USING (
    "id" IN (
      SELECT ts."tripId" FROM "TripStop" ts
      JOIN "Child" c ON c.id = ts."childId"
      JOIN "Parent" p ON p.id = c."parentId"
      WHERE p.userId = auth_user_id()
    )
  );

-- ── TripStop ──
CREATE POLICY "TripStop driver access" ON "TripStop"
  FOR ALL USING (
    "tripId" IN (SELECT id FROM "Trip" WHERE "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id()))
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "TripStop parent read" ON "TripStop"
  FOR SELECT USING (
    "tripId" IN (
      SELECT t.id FROM "Trip" t
      JOIN "TripStop" ts2 ON ts2."tripId" = t.id
      JOIN "Child" c ON c.id = ts2."childId"
      JOIN "Parent" p ON p.id = c."parentId"
      WHERE p.userId = auth_user_id()
    )
  );

-- ── Transaction / Payout ──
CREATE POLICY "Transaction parent read" ON "Transaction"
  FOR SELECT USING (
    "parentId" IN (SELECT id FROM "Parent" WHERE userId = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );
CREATE POLICY "Payout driver read" ON "Payout"
  FOR SELECT USING (
    "driverId" IN (SELECT id FROM "Driver" WHERE userId = auth_user_id())
    OR auth_user_role() = 'ADMIN'
  );

-- ── Association ──
-- Public read for active associations. Admin write only.
CREATE POLICY "Association public read" ON "Association"
  FOR SELECT USING (true);
CREATE POLICY "Association admin write" ON "Association"
  FOR ALL USING (auth_user_role() = 'ADMIN');
