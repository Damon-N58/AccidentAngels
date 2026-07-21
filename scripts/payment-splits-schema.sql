-- ============================================================================
-- Payment Splits -- configurable multi-party revenue splitting
-- ============================================================================
-- Replaces the hard-coded 5-column split (gatewayFee/platformFee/
-- associationLevy/tccSplit/driverNet) with an admin-configurable scheme.
--
-- Parties (drivers, insurance, associations, Nineteen58, Accident Angels, ...)
-- each take a cut of the gross fee the parent pays. The driver receives the
-- REMAINDER after everyone else's cut and the payment-gateway fee.
--
-- Run manually against Supabase (SQL editor) -- this project does not use
-- `prisma migrate`. Column names are double-quoted to preserve camelCase.
-- Idempotent: safe to re-run. Pure ASCII (no smart quotes / arrows).
-- ============================================================================

-- Enums ----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "SplitPartyKind" AS ENUM ('FIXED', 'DRIVER', 'ASSOCIATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SplitCalcType" AS ENUM ('PERCENT', 'FLAT', 'REMAINDER', 'ASSOCIATION_LEVY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- SplitParty: a configurable recipient ---------------------------------------
-- kind = FIXED       : org-level party with its own paystackSubAccountCode
--        DRIVER      : resolved per-transaction from Driver.paystackSubAccountCode
--        ASSOCIATION : resolved per-transaction from the driver's Association
CREATE TABLE IF NOT EXISTS "SplitParty" (
  "id"                     TEXT PRIMARY KEY,
  "key"                    TEXT UNIQUE NOT NULL,
  "label"                  TEXT NOT NULL,
  "kind"                   "SplitPartyKind" NOT NULL DEFAULT 'FIXED',
  "paystackSubAccountCode" TEXT,
  "isActive"               BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder"              INTEGER NOT NULL DEFAULT 0,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SplitScheme: a versioned set of shares; exactly one is active --------------
CREATE TABLE IF NOT EXISTS "SplitScheme" (
  "id"                TEXT PRIMARY KEY,
  "name"              TEXT NOT NULL,
  "isActive"          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Paystack ZA local fee 2.9% + R1, +15% VAT = 3.335% + R1.15 (VAT-inclusive).
  "gatewayPercentBps" INTEGER NOT NULL DEFAULT 334,
  "gatewayFlatCents"  INTEGER NOT NULL DEFAULT 115,
  "notes"             TEXT,
  "createdByUserId"   TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "activatedAt"       TIMESTAMPTZ
);

-- Only one scheme active at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "SplitScheme_one_active"
  ON "SplitScheme" ("isActive") WHERE "isActive" = TRUE;

-- SplitShare: one party's cut within a scheme --------------------------------
-- calcType = PERCENT          : value = basis points of gross (10000 = 100%)
--            FLAT             : value = cents
--            REMAINDER        : value ignored; gets whatever is left (one per scheme)
--            ASSOCIATION_LEVY : value ignored; reads the driver's Association.monthlyLevy
CREATE TABLE IF NOT EXISTS "SplitShare" (
  "id"        TEXT PRIMARY KEY,
  "schemeId"  TEXT NOT NULL REFERENCES "SplitScheme"("id") ON DELETE CASCADE,
  "partyId"   TEXT NOT NULL REFERENCES "SplitParty"("id")  ON DELETE CASCADE,
  "calcType"  "SplitCalcType" NOT NULL,
  "value"     INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("schemeId", "partyId")
);
CREATE INDEX IF NOT EXISTS "SplitShare_schemeId_idx" ON "SplitShare" ("schemeId");

-- Only one REMAINDER share per scheme.
CREATE UNIQUE INDEX IF NOT EXISTS "SplitShare_one_remainder"
  ON "SplitShare" ("schemeId") WHERE "calcType" = 'REMAINDER';

-- TransactionSplit: per-charge audit trail (source of truth) -----------------
CREATE TABLE IF NOT EXISTS "TransactionSplit" (
  "id"                     TEXT PRIMARY KEY,
  "transactionId"          TEXT NOT NULL,
  "schemeId"               TEXT,
  "partyId"                TEXT,
  "partyKey"               TEXT NOT NULL,
  "partyLabel"             TEXT NOT NULL,
  "partyKind"              "SplitPartyKind" NOT NULL,
  "calcType"               "SplitCalcType" NOT NULL,
  "resolvedSubAccountCode" TEXT,
  "amountCents"            INTEGER NOT NULL,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "TransactionSplit_transactionId_idx"
  ON "TransactionSplit" ("transactionId");

-- ============================================================================
-- Seed: reproduce the CURRENT hard-coded behaviour exactly.
-- Single-row inserts so any one line is easy to isolate if an editor mangles it.
-- ============================================================================

INSERT INTO "SplitParty" ("id", "key", "label", "kind", "sortOrder")
  VALUES ('splitparty_driver', 'driver', 'Driver', 'DRIVER', 100)
  ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SplitParty" ("id", "key", "label", "kind", "sortOrder")
  VALUES ('splitparty_association', 'association', 'Association', 'ASSOCIATION', 10)
  ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SplitParty" ("id", "key", "label", "kind", "sortOrder")
  VALUES ('splitparty_platform', 'nineteen58', 'Nineteen58 (Platform)', 'FIXED', 20)
  ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SplitParty" ("id", "key", "label", "kind", "sortOrder")
  VALUES ('splitparty_tcc', 'accident_angels', 'Accident Angels', 'FIXED', 30)
  ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SplitParty" ("id", "key", "label", "kind", "sortOrder")
  VALUES ('splitparty_insurance', 'insurance', 'Insurance', 'FIXED', 40)
  ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SplitScheme" ("id", "name", "isActive", "gatewayPercentBps", "gatewayFlatCents", "activatedAt", "notes")
  VALUES ('splitscheme_default', 'Default scheme', TRUE, 334, 115, now(),
          'Auto-seeded. Gateway fee = Paystack ZA 2.9% + R1 + 15% VAT. Edit shares in Admin > Settings > Splits.')
  ON CONFLICT ("id") DO NOTHING;

-- Association -> dynamic monthlyLevy (matches legacy associationLevyCents)
INSERT INTO "SplitShare" ("id", "schemeId", "partyId", "calcType", "value", "sortOrder")
  VALUES ('splitshare_association', 'splitscheme_default', 'splitparty_association', 'ASSOCIATION_LEVY', 0, 10)
  ON CONFLICT ("schemeId", "partyId") DO NOTHING;

-- Platform (Nineteen58) -> flat, seeded from current PLATFORM_FEE_CENTS
INSERT INTO "SplitShare" ("id", "schemeId", "partyId", "calcType", "value", "sortOrder")
  SELECT 'splitshare_platform', 'splitscheme_default', 'splitparty_platform', 'FLAT',
         COALESCE((SELECT NULLIF("value", '')::int FROM "PlatformConfig" WHERE "key" = 'PLATFORM_FEE_CENTS'), 0), 20
  ON CONFLICT ("schemeId", "partyId") DO NOTHING;

-- Accident Angels (TCC) -> flat, seeded from current TCC_SPLIT_CENTS
INSERT INTO "SplitShare" ("id", "schemeId", "partyId", "calcType", "value", "sortOrder")
  SELECT 'splitshare_tcc', 'splitscheme_default', 'splitparty_tcc', 'FLAT',
         COALESCE((SELECT NULLIF("value", '')::int FROM "PlatformConfig" WHERE "key" = 'TCC_SPLIT_CENTS'), 0), 30
  ON CONFLICT ("schemeId", "partyId") DO NOTHING;

-- Insurance -> new party, starts at 0 (admin configures)
INSERT INTO "SplitShare" ("id", "schemeId", "partyId", "calcType", "value", "sortOrder")
  VALUES ('splitshare_insurance', 'splitscheme_default', 'splitparty_insurance', 'FLAT', 0, 40)
  ON CONFLICT ("schemeId", "partyId") DO NOTHING;

-- Driver -> REMAINDER (everything left after gateway fee + all cuts above)
INSERT INTO "SplitShare" ("id", "schemeId", "partyId", "calcType", "value", "sortOrder")
  VALUES ('splitshare_driver', 'splitscheme_default', 'splitparty_driver', 'REMAINDER', 0, 100)
  ON CONFLICT ("schemeId", "partyId") DO NOTHING;
