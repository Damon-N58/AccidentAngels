-- ============================================================================
-- Payment hardening -- Transaction-level integrity guards
-- ============================================================================
-- Run manually against Supabase (SQL editor) AFTER payment-splits-schema.sql.
-- Idempotent. Pure ASCII.
--
-- These constraints are the race-safe backstop the application code relies on:
-- the billing cron does INSERT-then-charge and treats a unique violation (23505)
-- as "already billed this month, skip", which is the only correct guard against
-- two overlapping cron runs double-charging the same child.
-- ============================================================================

-- One active charge per parent/child/billing-month. A CANCELLED row does not
-- count, so a month can be legitimately re-billed after cancellation.
--
-- IMPORTANT: if duplicate historical rows already exist this index creation
-- FAILS. Find them first with:
--   SELECT "parentId","childId","billingMonth","billingYear", count(*)
--   FROM "Transaction" WHERE status <> 'CANCELLED'
--   GROUP BY 1,2,3,4 HAVING count(*) > 1;
-- and resolve (cancel/merge) before running this.
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_one_active_bill"
  ON "Transaction" ("parentId", "childId", "billingMonth", "billingYear")
  WHERE "status" <> 'CANCELLED';

-- Retry drain: the retry cron selects RETRY_SCHEDULED ordered by nextRetryAt;
-- index it so the oldest-due retries are never starved at scale.
CREATE INDEX IF NOT EXISTS "Transaction_retry_due"
  ON "Transaction" ("nextRetryAt")
  WHERE "status" = 'RETRY_SCHEDULED';

-- Money columns must never be negative.
DO $$ BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_amounts_nonneg"
    CHECK ("grossAmountCents" >= 0 AND "driverNetCents" >= 0 AND "gatewayFeeCents" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;
