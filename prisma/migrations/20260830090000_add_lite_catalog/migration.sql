-- AlterTable
ALTER TABLE "Video" ADD COLUMN "isLitePublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Video" ADD COLUMN "liteSortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Video_isLitePublished_isPublished_safetyStatus_liteSortOrder_idx"
ON "Video"("isLitePublished", "isPublished", "safetyStatus", "liteSortOrder");
