ALTER TABLE "Advertisement"
ADD COLUMN "generatedAutomatically" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "generatedAt" TIMESTAMP(3),
ADD COLUMN "sourcePropertyUpdatedAt" TIMESTAMP(3),
ADD COLUMN "generatorVersion" TEXT;

ALTER TABLE "AdvertisementVersion"
ADD COLUMN "type" "AdType" NOT NULL DEFAULT 'MARKETPLACE',
ADD COLUMN "language" "AdLanguage" NOT NULL DEFAULT 'FR',
ADD COLUMN "changeSource" TEXT;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "propertyId", "type", "language"
           ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
         ) AS row_num
  FROM "Advertisement"
  WHERE "propertyId" IS NOT NULL
)
DELETE FROM "Advertisement"
WHERE id IN (
  SELECT id FROM ranked WHERE row_num > 1
);

CREATE UNIQUE INDEX "Advertisement_propertyId_type_language_key"
ON "Advertisement"("propertyId", "type", "language");
