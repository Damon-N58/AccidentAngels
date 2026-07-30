-- ============================================================================
-- Per-driver (per-car) monthly fee
-- ============================================================================
-- Run manually against Supabase (SQL editor). Idempotent. Pure ASCII.
--
-- Each driver sets the monthly amount they charge per child. This is the car's
-- rate; it is SNAPSHOTTED into Contract.monthlyAmountCents when a child is
-- assigned (so a later rate change only affects new contracts). Billing charges
-- Contract.monthlyAmountCents.
-- ============================================================================

ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "monthlyFeeCents" INTEGER NOT NULL DEFAULT 0;
