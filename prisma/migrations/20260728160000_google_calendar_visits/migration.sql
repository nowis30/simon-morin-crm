-- Google Calendar integration and visit scheduling improvements

ALTER TABLE "Visit"
ADD COLUMN IF NOT EXISTS "minimumLeadHours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "noShowAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
ADD COLUMN IF NOT EXISTS "googleEventId" TEXT,
ADD COLUMN IF NOT EXISTS "googleEventHtmlLink" TEXT,
ADD COLUMN IF NOT EXISTS "googleSyncStatus" TEXT,
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE TABLE IF NOT EXISTS "GoogleCalendarConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "googleAccountEmail" TEXT,
  "calendarId" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarConnection_userId_key" ON "GoogleCalendarConnection"("userId");
CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_updatedAt_idx" ON "GoogleCalendarConnection"("updatedAt");

ALTER TABLE "GoogleCalendarConnection"
ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "VisitAvailabilitySettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'America/Toronto',
  "visitDurationMinutes" INTEGER NOT NULL DEFAULT 30,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 30,
  "minLeadHours" INTEGER NOT NULL DEFAULT 2,
  "maxVisitsPerEvening" INTEGER NOT NULL DEFAULT 4,
  "weekSchedule" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitAvailabilitySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VisitAvailabilitySettings_userId_key" ON "VisitAvailabilitySettings"("userId");
CREATE INDEX IF NOT EXISTS "VisitAvailabilitySettings_updatedAt_idx" ON "VisitAvailabilitySettings"("updatedAt");

ALTER TABLE "VisitAvailabilitySettings"
ADD CONSTRAINT "VisitAvailabilitySettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "VisitBlockedPeriod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisitBlockedPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VisitBlockedPeriod_userId_startsAt_endsAt_idx" ON "VisitBlockedPeriod"("userId", "startsAt", "endsAt");

ALTER TABLE "VisitBlockedPeriod"
ADD CONSTRAINT "VisitBlockedPeriod_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Visit_prospectId_propertyId_startsAt_key" ON "Visit"("prospectId", "propertyId", "startsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Visit_idempotencyKey_key" ON "Visit"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Visit_googleEventId_key" ON "Visit"("googleEventId");
