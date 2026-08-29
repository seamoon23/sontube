-- CreateTable
CREATE TABLE "AppAccessKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trialStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" DATETIME NOT NULL,
    "paidUntil" DATETIME,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "installationId" TEXT,
    "registeredAt" DATETIME
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KidsVideoSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoTag" (
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("videoId", "tagId"),
    FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AppAccessKey_installationId_idx" ON "AppAccessKey"("installationId" ASC);

-- CreateIndex
CREATE INDEX "AppAccessKey_paidUntil_idx" ON "AppAccessKey"("paidUntil" ASC);

-- CreateIndex
CREATE INDEX "AppAccessKey_trialEndsAt_idx" ON "AppAccessKey"("trialEndsAt" ASC);

-- CreateIndex
CREATE INDEX "AppAccessKey_keyPrefix_idx" ON "AppAccessKey"("keyPrefix" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AppAccessKey_keyHash_key" ON "AppAccessKey"("keyHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "KidsVideoSignal_videoId_clientKey_type_key" ON "KidsVideoSignal"("videoId" ASC, "clientKey" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "KidsVideoSignal_updatedAt_idx" ON "KidsVideoSignal"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "KidsVideoSignal_videoId_idx" ON "KidsVideoSignal"("videoId" ASC);

-- CreateIndex
CREATE INDEX "KidsVideoSignal_type_idx" ON "KidsVideoSignal"("type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Video_youtubeVideoId_key" ON "Video"("youtubeVideoId" ASC);
