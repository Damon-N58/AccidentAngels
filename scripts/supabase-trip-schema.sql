-- ─────────────────────────────────────────────────────────────
-- Accident Angels — Trip Scheduling Schema
-- Paste this into Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────

-- New Enums
CREATE TYPE "TripType" AS ENUM ('MORNING', 'AFTERNOON');
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TripStopType" AS ENUM ('PICKUP', 'DROPOFF');
CREATE TYPE "TripStopStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED');
CREATE TYPE "OverrideAction" AS ENUM ('SKIP', 'ADD');

-- ChildSchedule — recurring weekly schedule per child
CREATE TABLE "ChildSchedule" (
  "id"                      TEXT         NOT NULL,
  "childId"                 TEXT         NOT NULL,
  "daysOfWeek"              JSONB        NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  "startDate"               TIMESTAMP(3) NOT NULL,
  "endDate"                 TIMESTAMP(3),
  "effectiveDate"           TIMESTAMP(3),
  "morningPickupEarliest"   TEXT,
  "morningPickupLatest"     TEXT,
  "morningDropoffEarliest"  TEXT,
  "morningDropoffLatest"    TEXT,
  "afternoonPickupEarliest" TEXT,
  "afternoonPickupLatest"   TEXT,
  "afternoonDropoffEarliest" TEXT,
  "afternoonDropoffLatest"  TEXT,
  "isActive"                BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChildSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChildSchedule_childId_idx" ON "ChildSchedule"("childId");
CREATE INDEX "ChildSchedule_childId_isActive_idx" ON "ChildSchedule"("childId", "isActive");

-- ScheduleOverride — skip or add specific dates
CREATE TABLE "ScheduleOverride" (
  "id"           TEXT             NOT NULL,
  "childId"      TEXT             NOT NULL,
  "date"         DATE             NOT NULL,
  "action"       "OverrideAction" NOT NULL,
  "reason"       TEXT,
  "overrideTime" TEXT,
  "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleOverride_childId_date_key" UNIQUE ("childId", "date")
);
CREATE INDEX "ScheduleOverride_childId_idx" ON "ScheduleOverride"("childId");
CREATE INDEX "ScheduleOverride_date_idx" ON "ScheduleOverride"("date");

-- Trip — a scheduled route on a specific date
CREATE TABLE "Trip" (
  "id"                   TEXT        NOT NULL,
  "driverId"             TEXT        NOT NULL,
  "date"                 DATE        NOT NULL,
  "type"                 "TripType"  NOT NULL,
  "status"               "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
  "totalDistanceMeters"  INTEGER,
  "totalDurationSeconds" INTEGER,
  "optimizedRoute"       JSONB,
  "driverStartedAt"      TIMESTAMP(3),
  "driverEndedAt"        TIMESTAMP(3),
  "cancelledAt"          TIMESTAMP(3),
  "cancelReason"         TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Trip_driverId_date_type_key" ON "Trip"("driverId", "date", "type");
CREATE INDEX "Trip_driverId_status_idx" ON "Trip"("driverId", "status");
CREATE INDEX "Trip_date_idx" ON "Trip"("date");

-- TripStop — each child's pickup/dropoff in a trip
CREATE TABLE "TripStop" (
  "id"             TEXT             NOT NULL,
  "tripId"         TEXT             NOT NULL,
  "childId"        TEXT             NOT NULL,
  "type"           "TripStopType"   NOT NULL,
  "stopOrder"      INTEGER          NOT NULL,
  "address"        TEXT             NOT NULL,
  "lat"            DOUBLE PRECISION,
  "lng"            DOUBLE PRECISION,
  "scheduledTime"  TIMESTAMP(3),
  "estimatedTime"  TIMESTAMP(3),
  "actualTime"     TIMESTAMP(3),
  "status"         "TripStopStatus" NOT NULL DEFAULT 'PENDING',
  "notes"          TEXT,
  "missedReason"   TEXT,
  "completedAt"    TIMESTAMP(3),
  CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TripStop_tripId_stopOrder_idx" ON "TripStop"("tripId", "stopOrder");
CREATE INDEX "TripStop_tripId_status_idx" ON "TripStop"("tripId", "status");

-- Foreign keys
ALTER TABLE "ChildSchedule"   ADD CONSTRAINT "ChildSchedule_childId_fkey"    FOREIGN KEY ("childId")  REFERENCES "Child"("id")     ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_childId_fkey"  FOREIGN KEY ("childId")  REFERENCES "Child"("id")     ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip"            ADD CONSTRAINT "Trip_driverId_fkey"             FOREIGN KEY ("driverId") REFERENCES "Driver"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TripStop"        ADD CONSTRAINT "TripStop_tripId_fkey"           FOREIGN KEY ("tripId")   REFERENCES "Trip"("id")      ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripStop"        ADD CONSTRAINT "TripStop_childId_fkey"          FOREIGN KEY ("childId")  REFERENCES "Child"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;

-- Triggers
DROP TRIGGER IF EXISTS trg_childschedule_updated_at ON "ChildSchedule";
CREATE TRIGGER trg_childschedule_updated_at BEFORE UPDATE ON "ChildSchedule" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_trip_updated_at ON "Trip";
CREATE TRIGGER trg_trip_updated_at BEFORE UPDATE ON "Trip" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
