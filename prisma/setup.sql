-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Database setup
-- Paste this into Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────

-- Auto-update updatedAt on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;


-- Enums
CREATE TYPE "UserRole" AS ENUM ('DRIVER', 'PARENT', 'ADMIN', 'ASSOCIATION_ADMIN');
CREATE TYPE "ComplianceDocType" AS ENUM ('PDP', 'POLICE_CLEARANCE', 'PASSENGER_LIABILITY', 'ROADWORTHY_CERTIFICATE', 'VEHICLE_PHOTOS', 'DRIVER_LICENSE');
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "DriverStatus" AS ENUM ('PENDING_COMPLIANCE', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_DRIVER_SIGNATURE', 'PENDING_PARENT_SIGNATURE', 'FULLY_SIGNED', 'CANCELLED');
CREATE TYPE "PaymentMethodType" AS ENUM ('PAYSTACK_CARD', 'DEBICHECK', 'CAPITEC_PAY_VRP');
CREATE TYPE "PaymentMethodStatus" AS ENUM ('PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'FAILED');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'RETRY_SCHEDULED', 'CANCELLED');

-- User
CREATE TABLE "User" (
  "id"        TEXT        NOT NULL,
  "phone"     TEXT        NOT NULL,
  "email"     TEXT,
  "name"      TEXT        NOT NULL,
  "role"      "UserRole"  NOT NULL,
  "isActive"  BOOLEAN     NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- OtpToken
CREATE TABLE "OtpToken" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT,
  "phone"     TEXT         NOT NULL,
  "code"      TEXT         NOT NULL,
  "purpose"   TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtpToken_phone_purpose_idx" ON "OtpToken"("phone", "purpose");

-- Association
CREATE TABLE "Association" (
  "id"                    TEXT         NOT NULL,
  "name"                  TEXT         NOT NULL,
  "code"                  TEXT         NOT NULL,
  "region"                TEXT         NOT NULL,
  "monthlyLevy"           INTEGER      NOT NULL DEFAULT 0,
  "contactName"           TEXT         NOT NULL,
  "contactPhone"          TEXT         NOT NULL,
  "contactEmail"          TEXT,
  "bankName"              TEXT,
  "bankAccount"           TEXT,
  "bankBranch"            TEXT,
  "paystackSubAccountCode" TEXT,
  "isActive"              BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Association_code_key" ON "Association"("code");

-- Driver
CREATE TABLE "Driver" (
  "id"                    TEXT           NOT NULL,
  "userId"                TEXT           NOT NULL,
  "associationId"         TEXT,
  "getsRegistrationNumber" TEXT,
  "vehicleRegistration"   TEXT,
  "vehicleMake"           TEXT,
  "vehicleModel"          TEXT,
  "vehicleYear"           INTEGER,
  "vehicleCapacity"       INTEGER,
  "vehicleColour"         TEXT,
  "bankName"              TEXT,
  "bankAccountNumber"     TEXT,
  "bankBranchCode"        TEXT,
  "bankAccountName"       TEXT,
  "paystackSubAccountCode" TEXT,
  "paystackSubAccountId"  TEXT,
  "status"                "DriverStatus" NOT NULL DEFAULT 'PENDING_COMPLIANCE',
  "profilePhotoUrl"       TEXT,
  "isVerifiedByAdmin"     BOOLEAN        NOT NULL DEFAULT false,
  "verifiedAt"            TIMESTAMP(3),
  "verifiedByUserId"      TEXT,
  "createdAt"             TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- ComplianceDocument
CREATE TABLE "ComplianceDocument" (
  "id"               TEXT                NOT NULL,
  "driverId"         TEXT                NOT NULL,
  "type"             "ComplianceDocType" NOT NULL,
  "status"           "ComplianceStatus"  NOT NULL DEFAULT 'PENDING',
  "fileUrl"          TEXT                NOT NULL,
  "fileName"         TEXT                NOT NULL,
  "fileSizeBytes"    INTEGER,
  "mimeType"         TEXT,
  "issueDate"        TIMESTAMP(3),
  "expiryDate"       TIMESTAMP(3),
  "documentNumber"   TEXT,
  "reviewNotes"      TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "createdAt"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComplianceDocument_driverId_type_idx"      ON "ComplianceDocument"("driverId", "type");
CREATE INDEX "ComplianceDocument_status_expiryDate_idx"  ON "ComplianceDocument"("status", "expiryDate");

-- Parent
CREATE TABLE "Parent" (
  "id"                         TEXT                  NOT NULL,
  "userId"                     TEXT                  NOT NULL,
  "paymentMethodType"          "PaymentMethodType",
  "paymentMethodStatus"        "PaymentMethodStatus" NOT NULL DEFAULT 'PENDING_SETUP',
  "paystackCustomerId"         TEXT,
  "paystackAuthorizationCode"  TEXT,
  "paystackAuthorizationEmail" TEXT,
  "paystackCardLast4"          TEXT,
  "paystackCardBank"           TEXT,
  "paystackCardBrand"          TEXT,
  "debiCheckMandateRef"        TEXT,
  "debiCheckMandateStatus"     TEXT,
  "debiCheckBankName"          TEXT,
  "debiCheckAccountNumber"     TEXT,
  "debiCheckBranchCode"        TEXT,
  "debiCheckIdNumber"          TEXT,
  "capitecPayEnrollmentCode"   TEXT,
  "capitecPayPhone"            TEXT,
  "capitecPayMaxAmountCents"   INTEGER,
  "capitecPayStartDate"        TIMESTAMP(3),
  "capitecPayExpiryDate"       TIMESTAMP(3),
  "capitecPayProvider"         TEXT,
  "isPaymentSetup"             BOOLEAN               NOT NULL DEFAULT false,
  "paymentSetupAt"             TIMESTAMP(3),
  "createdAt"                  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                  TIMESTAMP(3)          NOT NULL,
  CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Parent_userId_key" ON "Parent"("userId");

-- Child
CREATE TABLE "Child" (
  "id"             TEXT         NOT NULL,
  "parentId"       TEXT         NOT NULL,
  "driverId"       TEXT,
  "name"           TEXT         NOT NULL,
  "dateOfBirth"    TIMESTAMP(3),
  "schoolName"     TEXT         NOT NULL,
  "grade"          TEXT,
  "pickupAddress"  TEXT         NOT NULL,
  "pickupLat"      DOUBLE PRECISION,
  "pickupLng"      DOUBLE PRECISION,
  "dropoffAddress" TEXT         NOT NULL,
  "dropoffLat"     DOUBLE PRECISION,
  "dropoffLng"     DOUBLE PRECISION,
  "monthlyFee"     INTEGER,
  "startDate"      TIMESTAMP(3),
  "endDate"        TIMESTAMP(3),
  "isActive"       BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Child_parentId_idx" ON "Child"("parentId");
CREATE INDEX "Child_driverId_idx" ON "Child"("driverId");

-- Contract
CREATE TABLE "Contract" (
  "id"                      TEXT             NOT NULL,
  "driverId"                TEXT             NOT NULL,
  "parentId"                TEXT             NOT NULL,
  "childId"                 TEXT             NOT NULL,
  "contractVersion"         TEXT             NOT NULL DEFAULT '1.0',
  "monthlyAmountCents"      INTEGER          NOT NULL,
  "startDate"               TIMESTAMP(3)     NOT NULL,
  "endDate"                 TIMESTAMP(3),
  "terms"                   JSONB            NOT NULL,
  "status"                  "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "pdfUrl"                  TEXT,
  "driverSignedAt"          TIMESTAMP(3),
  "driverSignatureOtpHash"  TEXT,
  "driverIpAddress"         TEXT,
  "driverUserAgent"         TEXT,
  "parentSignedAt"          TIMESTAMP(3),
  "parentSignatureOtpHash"  TEXT,
  "parentIpAddress"         TEXT,
  "parentUserAgent"         TEXT,
  "parentPhone"             TEXT,
  "parentSigningToken"      TEXT,
  "parentSigningTokenExpiry" TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Contract_parentSigningToken_key" ON "Contract"("parentSigningToken");
CREATE INDEX "Contract_driverId_status_idx"        ON "Contract"("driverId", "status");
CREATE INDEX "Contract_parentId_status_idx"        ON "Contract"("parentId", "status");
CREATE INDEX "Contract_parentSigningToken_idx"     ON "Contract"("parentSigningToken");

-- Transaction
CREATE TABLE "Transaction" (
  "id"                  TEXT                 NOT NULL,
  "parentId"            TEXT                 NOT NULL,
  "driverId"            TEXT                 NOT NULL,
  "childId"             TEXT                 NOT NULL,
  "billingMonth"        INTEGER              NOT NULL,
  "billingYear"         INTEGER              NOT NULL,
  "grossAmountCents"    INTEGER              NOT NULL,
  "gatewayFeeCents"     INTEGER              NOT NULL,
  "platformFeeCents"    INTEGER              NOT NULL,
  "associationLevyCents" INTEGER             NOT NULL,
  "tccSplitCents"       INTEGER              NOT NULL,
  "driverNetCents"      INTEGER              NOT NULL,
  "paymentMethodType"   "PaymentMethodType",
  "status"              "TransactionStatus"  NOT NULL DEFAULT 'PENDING',
  "providerReference"   TEXT,
  "providerChargeId"    TEXT,
  "attemptCount"        INTEGER              NOT NULL DEFAULT 0,
  "lastAttemptAt"       TIMESTAMP(3),
  "nextRetryAt"         TIMESTAMP(3),
  "failureReason"       TEXT,
  "failureCode"         TEXT,
  "createdAt"           TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)         NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Transaction_providerReference_key"               ON "Transaction"("providerReference");
CREATE INDEX "Transaction_parentId_billingYear_billingMonth_idx"      ON "Transaction"("parentId", "billingYear", "billingMonth");
CREATE INDEX "Transaction_status_nextRetryAt_idx"                     ON "Transaction"("status", "nextRetryAt");

-- Payout
CREATE TABLE "Payout" (
  "id"            TEXT         NOT NULL,
  "driverId"      TEXT         NOT NULL,
  "amountCents"   INTEGER      NOT NULL,
  "providerRef"   TEXT,
  "status"        TEXT         NOT NULL DEFAULT 'PENDING',
  "scheduledAt"   TIMESTAMP(3) NOT NULL,
  "processedAt"   TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payout_driverId_status_idx" ON "Payout"("driverId", "status");

-- PlatformConfig
CREATE TABLE "PlatformConfig" (
  "id"              TEXT         NOT NULL,
  "key"             TEXT         NOT NULL,
  "value"           TEXT         NOT NULL,
  "description"     TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "updatedByUserId" TEXT,
  CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformConfig_key_key" ON "PlatformConfig"("key");

-- Foreign keys
ALTER TABLE "OtpToken"           ADD CONSTRAINT "OtpToken_userId_fkey"            FOREIGN KEY ("userId")       REFERENCES "User"("id")        ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Driver"             ADD CONSTRAINT "Driver_userId_fkey"               FOREIGN KEY ("userId")       REFERENCES "User"("id")        ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Driver"             ADD CONSTRAINT "Driver_associationId_fkey"        FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_driverId_fkey" FOREIGN KEY ("driverId")     REFERENCES "Driver"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Parent"             ADD CONSTRAINT "Parent_userId_fkey"               FOREIGN KEY ("userId")       REFERENCES "User"("id")        ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Child"              ADD CONSTRAINT "Child_parentId_fkey"              FOREIGN KEY ("parentId")     REFERENCES "Parent"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Child"              ADD CONSTRAINT "Child_driverId_fkey"              FOREIGN KEY ("driverId")     REFERENCES "Driver"("id")      ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "Contract"           ADD CONSTRAINT "Contract_driverId_fkey"           FOREIGN KEY ("driverId")     REFERENCES "Driver"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Contract"           ADD CONSTRAINT "Contract_parentId_fkey"           FOREIGN KEY ("parentId")     REFERENCES "Parent"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Contract"           ADD CONSTRAINT "Contract_childId_fkey"            FOREIGN KEY ("childId")      REFERENCES "Child"("id")       ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Transaction"        ADD CONSTRAINT "Transaction_parentId_fkey"        FOREIGN KEY ("parentId")     REFERENCES "Parent"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Transaction"        ADD CONSTRAINT "Transaction_driverId_fkey"        FOREIGN KEY ("driverId")     REFERENCES "Driver"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Transaction"        ADD CONSTRAINT "Transaction_childId_fkey"         FOREIGN KEY ("childId")      REFERENCES "Child"("id")       ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "Payout"             ADD CONSTRAINT "Payout_driverId_fkey"             FOREIGN KEY ("driverId")     REFERENCES "Driver"("id")      ON DELETE RESTRICT  ON UPDATE CASCADE;

-- Auto-updatedAt triggers
CREATE TRIGGER trg_user_updated_at           BEFORE UPDATE ON "User"               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_driver_updated_at         BEFORE UPDATE ON "Driver"             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_compliance_updated_at     BEFORE UPDATE ON "ComplianceDocument" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parent_updated_at         BEFORE UPDATE ON "Parent"             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_child_updated_at          BEFORE UPDATE ON "Child"              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contract_updated_at       BEFORE UPDATE ON "Contract"           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transaction_updated_at    BEFORE UPDATE ON "Transaction"        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_platformconfig_updated_at BEFORE UPDATE ON "PlatformConfig"     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
