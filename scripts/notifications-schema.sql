-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Notification table
-- Run AFTER setup.sql
-- Paste into Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────

-- Notification table for in-app alerts (compliance expiry, report filed)
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT         NOT NULL,
  "type"      TEXT         NOT NULL, -- COMPLIANCE_EXPIRY_WARNING | COMPLIANCE_EXPIRED | REPORT_FILED
  "title"     TEXT         NOT NULL,
  "body"      TEXT         NOT NULL,
  "isRead"    BOOLEAN      NOT NULL DEFAULT false,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
  ON "Notification"("userId", "isRead", "createdAt" DESC);

-- RLS
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Notification_own_read" ON "Notification"
  FOR SELECT USING (auth.uid()::text = "userId");

-- Users can mark their own notifications as read
CREATE POLICY "Notification_own_update" ON "Notification"
  FOR UPDATE USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");
