CREATE TABLE "MileageSettings" (
    "userId" TEXT NOT NULL,
    "homeAddress" TEXT NOT NULL,
    "defaultRoundTrip" BOOLEAN NOT NULL DEFAULT true,
    "vehicleDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageSettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "MileageYear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "openingOdometerKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingOdometerKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fuelAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insuranceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registrationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maintenanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leaseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageYear_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MileageTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visitId" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "originAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "oneWayKm" DOUBLE PRECISION NOT NULL,
    "businessKm" DOUBLE PRECISION NOT NULL,
    "roundTrip" BOOLEAN NOT NULL DEFAULT true,
    "parkingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tollAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distanceSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageTrip_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MileageTrip_distanceSource_check" CHECK ("distanceSource" IN ('MANUAL', 'GOOGLE_ROUTES', 'ODOMETER')),
    CONSTRAINT "MileageTrip_oneWayKm_check" CHECK ("oneWayKm" >= 0),
    CONSTRAINT "MileageTrip_businessKm_check" CHECK ("businessKm" >= 0),
    CONSTRAINT "MileageTrip_parkingAmount_check" CHECK ("parkingAmount" >= 0),
    CONSTRAINT "MileageTrip_tollAmount_check" CHECK ("tollAmount" >= 0)
);

CREATE UNIQUE INDEX "MileageYear_userId_year_key" ON "MileageYear"("userId", "year");
CREATE INDEX "MileageYear_userId_year_idx" ON "MileageYear"("userId", "year");
CREATE UNIQUE INDEX "MileageTrip_visitId_key" ON "MileageTrip"("visitId");
CREATE INDEX "MileageTrip_userId_tripDate_idx" ON "MileageTrip"("userId", "tripDate");
CREATE INDEX "MileageTrip_visitId_idx" ON "MileageTrip"("visitId");

ALTER TABLE "MileageSettings"
ADD CONSTRAINT "MileageSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MileageYear"
ADD CONSTRAINT "MileageYear_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MileageTrip"
ADD CONSTRAINT "MileageTrip_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MileageTrip"
ADD CONSTRAINT "MileageTrip_visitId_fkey"
FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
