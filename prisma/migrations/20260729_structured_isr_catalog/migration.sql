-- Add structured ISR catalog support for Building, RentalUnit, and related history tracking

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RentalUnitChangeType') THEN
    CREATE TYPE "RentalUnitChangeType" AS ENUM (
      'PRICE_CHANGED',
      'STATUS_CHANGED',
      'AVAILABILITY_CHANGED',
      'DESCRIPTION_CHANGED',
      'FEATURES_CHANGED',
      'PHOTOS_CHANGED',
      'UNIT_ADDED',
      'UNIT_REMOVED_FROM_SOURCE'
    );
  END IF;
END $$;

ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "buildingId" TEXT,
  ADD COLUMN IF NOT EXISTS "rentalUnitId" TEXT;

CREATE TABLE IF NOT EXISTS "Building" (
  "id" TEXT NOT NULL,
  "codeIsr" TEXT NOT NULL,
  "name" TEXT,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT,
  "description" TEXT,
  "gestionIsrUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BuildingPhoto" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuildingPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalUnit" (
  "id" TEXT NOT NULL,
  "codeIsr" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "unitNumber" TEXT,
  "floor" TEXT,
  "monthlyPrice" INTEGER NOT NULL,
  "bedrooms" INTEGER NOT NULL,
  "propertyType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
  "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
  "petsDetails" TEXT,
  "parking" BOOLEAN NOT NULL DEFAULT false,
  "inclusions" TEXT,
  "availableFrom" TIMESTAMP(3),
  "publicTitle" TEXT,
  "publicDescription" TEXT,
  "isPubliclyVisible" BOOLEAN,
  "primaryPhotoUrl" TEXT,
  "displayOrder" INTEGER,
  "internalNotes" TEXT,
  "gestionIsrUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalUnitPhoto" (
  "id" TEXT NOT NULL,
  "rentalUnitId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalUnitPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RentalUnitChange" (
  "id" TEXT NOT NULL,
  "rentalUnitId" TEXT NOT NULL,
  "syncRunId" TEXT,
  "field" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "changeType" "RentalUnitChangeType" NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  "source" TEXT,
  "metadata" JSONB,
  CONSTRAINT "RentalUnitChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Building_codeIsr_key" ON "Building"("codeIsr");
CREATE UNIQUE INDEX IF NOT EXISTS "RentalUnit_codeIsr_key" ON "RentalUnit"("codeIsr");
CREATE INDEX IF NOT EXISTS "Building_city_idx" ON "Building"("city");
CREATE INDEX IF NOT EXISTS "RentalUnit_buildingId_status_idx" ON "RentalUnit"("buildingId", "status");
CREATE INDEX IF NOT EXISTS "RentalUnitPhoto_rentalUnitId_sortOrder_idx" ON "RentalUnitPhoto"("rentalUnitId", "sortOrder");
CREATE INDEX IF NOT EXISTS "RentalUnitChange_rentalUnitId_detectedAt_idx" ON "RentalUnitChange"("rentalUnitId", "detectedAt");
CREATE INDEX IF NOT EXISTS "RentalUnitChange_syncRunId_idx" ON "RentalUnitChange"("syncRunId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Property_buildingId_fkey') THEN
    ALTER TABLE "Property"
      ADD CONSTRAINT "Property_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Property_rentalUnitId_fkey') THEN
    ALTER TABLE "Property"
      ADD CONSTRAINT "Property_rentalUnitId_fkey"
      FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuildingPhoto_buildingId_fkey') THEN
    ALTER TABLE "BuildingPhoto"
      ADD CONSTRAINT "BuildingPhoto_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalUnit_buildingId_fkey') THEN
    ALTER TABLE "RentalUnit"
      ADD CONSTRAINT "RentalUnit_buildingId_fkey"
      FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalUnitPhoto_rentalUnitId_fkey') THEN
    ALTER TABLE "RentalUnitPhoto"
      ADD CONSTRAINT "RentalUnitPhoto_rentalUnitId_fkey"
      FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RentalUnitChange_rentalUnitId_fkey') THEN
    ALTER TABLE "RentalUnitChange"
      ADD CONSTRAINT "RentalUnitChange_rentalUnitId_fkey"
      FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
