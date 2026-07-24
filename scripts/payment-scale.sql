-- ============================================================================
-- Payment scale & reliability -- queue, rate limiting, dunning
-- ============================================================================
-- Run manually against Supabase AFTER payment-splits-schema.sql and
-- payment-hardening.sql. Idempotent. Pure ASCII.
-- ============================================================================

-- ── Billing queue: claim column ─────────────────────────────────────────────
-- The Transaction table IS the billing queue. The charge worker atomically
-- claims a row (claimedAt) before charging so concurrent workers never charge
-- the same row twice. A row PENDING with a stale claimedAt is swept by the
-- reconciliation cron.
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMPTZ;

-- Fast lookup of chargeable work (PENDING not-yet-claimed, or claim expired).
CREATE INDEX IF NOT EXISTS "Transaction_chargeable"
  ON "Transaction" ("status", "claimedAt");

-- ── Distributed rate limiter (fixed window) ─────────────────────────────────
-- The old limiter was an in-process Map: useless across serverless instances.
-- This is a shared counter keyed per subject; the function does an atomic
-- upsert-and-increment and returns whether the caller is within the limit.
CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key"         TEXT PRIMARY KEY,
  "windowStart" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "count"       INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT, p_max INT, p_window_seconds INT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  now_ts  TIMESTAMPTZ := now();
BEGIN
  INSERT INTO "RateLimit" ("key", "windowStart", "count")
  VALUES (p_key, now_ts, 1)
  ON CONFLICT ("key") DO UPDATE SET
    "count" = CASE
      WHEN "RateLimit"."windowStart" < now_ts - make_interval(secs => p_window_seconds)
      THEN 1 ELSE "RateLimit"."count" + 1 END,
    "windowStart" = CASE
      WHEN "RateLimit"."windowStart" < now_ts - make_interval(secs => p_window_seconds)
      THEN now_ts ELSE "RateLimit"."windowStart" END
  RETURNING "count" INTO v_count;
  RETURN v_count <= p_max;
END $$;

ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY; -- service-role only

-- ── Dunning / WhatsApp ──────────────────────────────────────────────────────
-- Where to reach the parent for payment reminders (falls back to their login
-- phone). Captured from the parent profile screen.
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "whatsappPhone" TEXT;

-- Durable outbox for WhatsApp reminders. The WhatsApp integration is NOT built
-- yet (see WHATSAPP_INTEGRATION_TODO.md) -- reminders are written here so
-- nothing is lost, and a worker can drain them once the integration lands.
CREATE TABLE IF NOT EXISTS "WhatsAppOutbox" (
  "id"         TEXT PRIMARY KEY,
  "toPhone"    TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "kind"       TEXT NOT NULL DEFAULT 'DUNNING',
  "parentId"   TEXT,
  "status"     TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED | SENT | FAILED
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sentAt"     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "WhatsAppOutbox_status" ON "WhatsAppOutbox" ("status", "createdAt");
ALTER TABLE "WhatsAppOutbox" ENABLE ROW LEVEL SECURITY; -- service-role only
