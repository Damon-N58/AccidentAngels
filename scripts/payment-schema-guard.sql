-- ============================================================================
-- Payments schema guard -- go-live gate
-- ============================================================================
-- Run manually against Supabase (SQL editor) AS THE LAST payments migration,
-- AFTER: payment-splits-schema.sql, payment-hardening.sql, payment-scale.sql.
-- Idempotent. Pure ASCII.
--
-- WHY THIS EXISTS
-- The billing pipeline's double-charge safety depends on DB objects that are
-- created ONLY by the hand-run scripts above (the partial unique index, the
-- claimedAt column, the check_rate_limit function). Prisma does not create
-- them. If any script is skipped in an environment, concurrent billing can
-- double-charge and the claim/rate-limit logic breaks silently.
--
-- This function lets the application FAIL CLOSED: lib/payments/schema-guard.ts
-- calls check_payments_schema() before any enqueue/charge and refuses to run
-- unless every required object is present. Because this function is itself part
-- of the migration set, its ABSENCE (RPC error) also means "migrations not
-- applied" -> the app fails closed too.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_payments_schema()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  missing TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'Transaction' AND column_name = 'claimedAt')
    THEN missing := missing || 'column:Transaction.claimedAt'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'Parent' AND column_name = 'whatsappPhone')
    THEN missing := missing || 'column:Parent.whatsappPhone'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Transaction_one_active_bill')
    THEN missing := missing || 'index:Transaction_one_active_bill'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Transaction_retry_due')
    THEN missing := missing || 'index:Transaction_retry_due'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Transaction_chargeable')
    THEN missing := missing || 'index:Transaction_chargeable'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit')
    THEN missing := missing || 'function:check_rate_limit'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'RateLimit')
    THEN missing := missing || 'table:RateLimit'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'WhatsAppOutbox')
    THEN missing := missing || 'table:WhatsAppOutbox'; END IF;

  RETURN jsonb_build_object(
    'ready',   array_length(missing, 1) IS NULL,
    'missing', to_jsonb(missing)
  );
END $$;

GRANT EXECUTE ON FUNCTION check_payments_schema() TO service_role;
GRANT EXECUTE ON FUNCTION check_payments_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION check_payments_schema() TO anon;
