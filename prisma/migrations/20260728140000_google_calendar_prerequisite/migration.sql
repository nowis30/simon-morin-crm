-- The following Facebook migration alters this table, while its original
-- creation migration sorts after it. Supply the prerequisite for fresh installs
-- without changing the checksums of migrations already applied in production.
-- Existing databases keep their table and data unchanged.
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
