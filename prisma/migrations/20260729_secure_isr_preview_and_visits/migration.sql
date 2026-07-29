-- CreateTable
CREATE TABLE "GestionIsrSyncPreview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "GestionIsrSyncPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GestionIsrSyncPreview_userId_status_expiresAt_idx" ON "GestionIsrSyncPreview"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "GestionIsrSyncPreview_sourceHash_idx" ON "GestionIsrSyncPreview"("sourceHash");

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "gestionIsrSyncPreviewId" TEXT;

-- AddForeignKey
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_gestionIsrSyncPreviewId_fkey"
    FOREIGN KEY ("gestionIsrSyncPreviewId") REFERENCES "GestionIsrSyncPreview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
