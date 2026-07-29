/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `Advertisement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PublicationChannel" AS ENUM ('PAGE', 'MARKETPLACE', 'FACEBOOK_GROUP');

-- CreateEnum
CREATE TYPE "GroupPublicationStatus" AS ENUM ('PENDING', 'MANUAL_ACTION_REQUIRED', 'PUBLISHED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdvertisementStatus" ADD VALUE 'READY_FOR_REVIEW';
ALTER TYPE "AdvertisementStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "AdvertisementStatus" ADD VALUE 'APPROVED';
ALTER TYPE "AdvertisementStatus" ADD VALUE 'PUBLISHING';
ALTER TYPE "AdvertisementStatus" ADD VALUE 'MANUAL_ACTION_REQUIRED';
ALTER TYPE "AdvertisementStatus" ADD VALUE 'FAILED';
ALTER TYPE "AdvertisementStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Advertisement" ADD COLUMN     "approvalNotes" TEXT,
ADD COLUMN     "approvalWarnings" TEXT[],
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "contentFingerprint" TEXT,
ADD COLUMN     "externalPublicationId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "latestErrorMessage" TEXT,
ADD COLUMN     "publicationChannel" "PublicationChannel",
ADD COLUMN     "publishedByUserId" TEXT,
ADD COLUMN     "requiresManualAction" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AdvertisementVersion" ALTER COLUMN "type" DROP DEFAULT,
ALTER COLUMN "language" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GoogleCalendarConnection" ALTER COLUMN "scopes" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AdvertisementSelectedPhoto" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "propertyPhotoId" TEXT NOT NULL,
    "channel" "PublicationChannel" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisementSelectedPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisementPublication" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "channel" "PublicationChannel" NOT NULL,
    "destination" TEXT,
    "status" "AdvertisementStatus" NOT NULL DEFAULT 'DRAFT',
    "externalId" TEXT,
    "publicationUrl" TEXT,
    "idempotencyKey" TEXT,
    "errorMessage" TEXT,
    "checklist" JSONB,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "prospectsCount" INTEGER NOT NULL DEFAULT 0,
    "visitsCount" INTEGER NOT NULL DEFAULT 0,
    "placementsCount" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisementPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "pageAccessTokenEncrypted" TEXT NOT NULL,
    "userAccessTokenEncrypted" TEXT,
    "scopes" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "city" TEXT,
    "sectors" TEXT[],
    "language" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "isAdminOrModerator" BOOLEAN NOT NULL DEFAULT false,
    "rules" TEXT,
    "notes" TEXT,
    "lastPublishedAt" TIMESTAMP(3),
    "minDelayHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookGroupPublication" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "customText" TEXT,
    "publicationUrl" TEXT,
    "status" "GroupPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "warningMessages" TEXT[],
    "externalId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookGroupPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisementSelectedPhoto_advertisementId_channel_sortOrde_idx" ON "AdvertisementSelectedPhoto"("advertisementId", "channel", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisementSelectedPhoto_advertisementId_propertyPhotoId__key" ON "AdvertisementSelectedPhoto"("advertisementId", "propertyPhotoId", "channel");

-- CreateIndex
CREATE INDEX "AdvertisementPublication_advertisementId_channel_idx" ON "AdvertisementPublication"("advertisementId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisementPublication_idempotencyKey_key" ON "AdvertisementPublication"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_userId_key" ON "MetaConnection"("userId");

-- CreateIndex
CREATE INDEX "MetaConnection_updatedAt_idx" ON "MetaConnection"("updatedAt");

-- CreateIndex
CREATE INDEX "FacebookGroup_active_city_idx" ON "FacebookGroup"("active", "city");

-- CreateIndex
CREATE INDEX "FacebookGroupPublication_status_publishedAt_idx" ON "FacebookGroupPublication"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookGroupPublication_advertisementId_groupId_key" ON "FacebookGroupPublication"("advertisementId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertisement_idempotencyKey_key" ON "Advertisement"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisementSelectedPhoto" ADD CONSTRAINT "AdvertisementSelectedPhoto_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisementSelectedPhoto" ADD CONSTRAINT "AdvertisementSelectedPhoto_propertyPhotoId_fkey" FOREIGN KEY ("propertyPhotoId") REFERENCES "PropertyPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisementPublication" ADD CONSTRAINT "AdvertisementPublication_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookGroupPublication" ADD CONSTRAINT "FacebookGroupPublication_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookGroupPublication" ADD CONSTRAINT "FacebookGroupPublication_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FacebookGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
