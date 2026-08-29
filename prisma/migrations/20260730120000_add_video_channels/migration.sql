-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Channel_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT,
    "channelId" TEXT,
    "youtubeVideoId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "searchKeywords" TEXT,
    "durationText" TEXT,
    "thumbnailType" TEXT NOT NULL DEFAULT 'YOUTUBE',
    "youtubeThumbnailUrl" TEXT,
    "customThumbnailPath" TEXT,
    "safetyStatus" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isParentRecommended" BOOLEAN NOT NULL DEFAULT false,
    "parentRecommendedAt" DATETIME,
    "playMode" TEXT NOT NULL DEFAULT 'SINGLE_THEN_CLOSE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Video_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("createdAt", "customThumbnailPath", "description", "durationText", "familyId", "id", "isParentRecommended", "isPublished", "originalUrl", "parentRecommendedAt", "playMode", "safetyStatus", "searchKeywords", "thumbnailType", "title", "updatedAt", "youtubeThumbnailUrl", "youtubeVideoId") SELECT "createdAt", "customThumbnailPath", "description", "durationText", "familyId", "id", "isParentRecommended", "isPublished", "originalUrl", "parentRecommendedAt", "playMode", "safetyStatus", "searchKeywords", "thumbnailType", "title", "updatedAt", "youtubeThumbnailUrl", "youtubeVideoId" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_familyId_idx" ON "Video"("familyId");
CREATE INDEX "Video_channelId_idx" ON "Video"("channelId");
CREATE UNIQUE INDEX "Video_familyId_youtubeVideoId_key" ON "Video"("familyId", "youtubeVideoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Channel_familyId_normalizedName_key" ON "Channel"("familyId", "normalizedName");

-- CreateIndex
CREATE INDEX "Channel_familyId_isActive_idx" ON "Channel"("familyId", "isActive");
