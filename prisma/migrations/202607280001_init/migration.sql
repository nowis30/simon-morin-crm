-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'VISIT_SCHEDULED', 'RESERVED', 'RENTED', 'REMOVED', 'TO_VERIFY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'TO_CONTACT', 'QUALIFIED', 'PROPERTIES_PROPOSED', 'VISIT_REQUESTED', 'VISIT_CONFIRMED', 'FILE_SUBMITTED', 'ACCEPTED', 'PLACED', 'REFUSED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('REQUESTED', 'PENDING_APPROVAL', 'CONFIRMED', 'REFUSED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('PHONE', 'EMAIL', 'MESSENGER', 'SMS', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "AdType" AS ENUM ('MARKETPLACE', 'FACEBOOK_GROUP', 'MULTI_PROPERTY', 'MESSENGER_SHORT');

-- CreateEnum
CREATE TYPE "AdLanguage" AS ENUM ('FR', 'EN', 'BILINGUAL');

-- CreateEnum
CREATE TYPE "AdvertisementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "codeIsr" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "monthlyPrice" INTEGER NOT NULL,
    "propertyType" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "petsDetails" TEXT,
    "parking" BOOLEAN NOT NULL DEFAULT false,
    "inclusions" TEXT,
    "descriptionFr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "gestionIsrUrl" TEXT,
    "marketplaceUrl" TEXT,
    "facebookPostUrl" TEXT,
    "marketingPriority" INTEGER NOT NULL DEFAULT 3,
    "lastVerificationDate" TIMESTAMP(3),
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyPhoto" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "messengerUrl" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'fr',
    "maxBudget" INTEGER,
    "preferredDistricts" TEXT[],
    "bedroomsNeeded" INTEGER,
    "moveInDate" TIMESTAMP(3),
    "hasPets" BOOLEAN NOT NULL DEFAULT false,
    "needsParking" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "firstContactPropertyId" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastContactAt" TIMESTAMP(3),

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectInteraction" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "CommunicationType" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectPropertyMatch" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "budgetCompatible" BOOLEAN NOT NULL,
    "districtCompatible" BOOLEAN NOT NULL,
    "bedroomsCompatible" BOOLEAN NOT NULL,
    "dateCompatible" BOOLEAN NOT NULL,
    "petsCompatible" BOOLEAN NOT NULL,
    "parkingCompatible" BOOLEAN NOT NULL,
    "reasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectPropertyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 30,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "visitId" TEXT,
    "visitDate" TIMESTAMP(3),
    "sentToColleaguesDate" TIMESTAMP(3),
    "acceptanceDate" TIMESTAMP(3),
    "signatureDate" TIMESTAMP(3),
    "moveInDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "plannedAmount" INTEGER NOT NULL DEFAULT 500,
    "invoicedAmount" INTEGER,
    "receivedAmount" INTEGER,
    "invoiceNumber" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PLANNED',
    "billedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" "AdType" NOT NULL,
    "language" "AdLanguage" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AdvertisementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publicationUrl" TEXT,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisementVersion" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_codeIsr_key" ON "Property"("codeIsr");

-- CreateIndex
CREATE INDEX "Property_city_status_idx" ON "Property"("city", "status");

-- CreateIndex
CREATE INDEX "Property_monthlyPrice_idx" ON "Property"("monthlyPrice");

-- CreateIndex
CREATE INDEX "Property_bedrooms_idx" ON "Property"("bedrooms");

-- CreateIndex
CREATE INDEX "PropertyPhoto_propertyId_sortOrder_idx" ON "PropertyPhoto"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "Prospect_nextFollowUpAt_idx" ON "Prospect"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "ProspectInteraction_prospectId_at_idx" ON "ProspectInteraction"("prospectId", "at");

-- CreateIndex
CREATE INDEX "ProspectPropertyMatch_prospectId_score_idx" ON "ProspectPropertyMatch"("prospectId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectPropertyMatch_prospectId_propertyId_key" ON "ProspectPropertyMatch"("prospectId", "propertyId");

-- CreateIndex
CREATE INDEX "Visit_startsAt_status_idx" ON "Visit"("startsAt", "status");

-- CreateIndex
CREATE INDEX "Visit_prospectId_idx" ON "Visit"("prospectId");

-- CreateIndex
CREATE INDEX "Visit_propertyId_idx" ON "Visit"("propertyId");

-- CreateIndex
CREATE INDEX "Placement_moveInDate_idx" ON "Placement"("moveInDate");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_placementId_key" ON "Commission"("placementId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- CreateIndex
CREATE INDEX "Commission_createdAt_idx" ON "Commission"("createdAt");

-- CreateIndex
CREATE INDEX "Advertisement_status_publishedAt_idx" ON "Advertisement"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "AdvertisementVersion_advertisementId_createdAt_idx" ON "AdvertisementVersion"("advertisementId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_firstContactPropertyId_fkey" FOREIGN KEY ("firstContactPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectInteraction" ADD CONSTRAINT "ProspectInteraction_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectInteraction" ADD CONSTRAINT "ProspectInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectPropertyMatch" ADD CONSTRAINT "ProspectPropertyMatch_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectPropertyMatch" ADD CONSTRAINT "ProspectPropertyMatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisementVersion" ADD CONSTRAINT "AdvertisementVersion_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

