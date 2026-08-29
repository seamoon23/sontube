-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "wifiRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParentUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParentUser_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceKrw" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNo" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planCodeSnapshot" TEXT NOT NULL,
    "planNameSnapshot" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "durationDaysSnapshot" INTEGER NOT NULL,
    "depositorName" TEXT NOT NULL,
    "expectedDepositDate" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pendingKey" TEXT,
    "confirmedAt" DATETIME,
    "confirmedBy" TEXT,
    "receivedAmountKrw" INTEGER,
    "receivedDate" TEXT,
    "rejectedAt" DATETIME,
    "rejectedBy" TEXT,
    "expiredAt" DATETIME,
    "refundRequestedAt" DATETIME,
    "refundedAt" DATETIME,
    "refundedBy" TEXT,
    "refundAmountKrw" INTEGER NOT NULL DEFAULT 0,
    "userMemo" TEXT,
    "adminMemo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentRequest_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "ParentUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaymentPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilySubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilySubscription_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionGrant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionGrant_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "FamilySubscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionGrant_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentRequestId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "amountKrw" INTEGER NOT NULL,
    "reason" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "processedBy" TEXT,
    "adminMemo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentRefund_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentRefund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "ParentUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentRequestId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAuditLog_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuperAdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetFamilyId" TEXT,
    "targetUserId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppAccessKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "installationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trialStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" DATETIME NOT NULL,
    "paidUntil" DATETIME,
    "lastSyncedAt" DATETIME,
    "registeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppAccessKey_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AppAccessKey" ("createdAt", "id", "installationId", "isActive", "keyHash", "keyPrefix", "lastSyncedAt", "name", "paidUntil", "registeredAt", "trialEndsAt", "trialStartedAt", "updatedAt") SELECT "createdAt", "id", "installationId", "isActive", "keyHash", "keyPrefix", "lastSyncedAt", "name", "paidUntil", "registeredAt", "trialEndsAt", "trialStartedAt", "updatedAt" FROM "AppAccessKey";
DROP TABLE "AppAccessKey";
ALTER TABLE "new_AppAccessKey" RENAME TO "AppAccessKey";
CREATE UNIQUE INDEX "AppAccessKey_keyHash_key" ON "AppAccessKey"("keyHash");
CREATE UNIQUE INDEX "AppAccessKey_installationId_key" ON "AppAccessKey"("installationId");
CREATE INDEX "AppAccessKey_keyPrefix_idx" ON "AppAccessKey"("keyPrefix");
CREATE INDEX "AppAccessKey_familyId_idx" ON "AppAccessKey"("familyId");
CREATE INDEX "AppAccessKey_trialEndsAt_idx" ON "AppAccessKey"("trialEndsAt");
CREATE INDEX "AppAccessKey_paidUntil_idx" ON "AppAccessKey"("paidUntil");
CREATE TABLE "new_Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tag_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Tag" ("color", "createdAt", "description", "icon", "id", "isActive", "lastUsedAt", "name", "slug", "sortOrder", "updatedAt", "usageCount") SELECT "color", "createdAt", "description", "icon", "id", "isActive", "lastUsedAt", "name", "slug", "sortOrder", "updatedAt", "usageCount" FROM "Tag";
DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";
CREATE INDEX "Tag_familyId_idx" ON "Tag"("familyId");
CREATE UNIQUE INDEX "Tag_familyId_slug_key" ON "Tag"("familyId", "slug");
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT,
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
    CONSTRAINT "Video_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("createdAt", "customThumbnailPath", "description", "durationText", "id", "isParentRecommended", "isPublished", "originalUrl", "parentRecommendedAt", "playMode", "safetyStatus", "searchKeywords", "thumbnailType", "title", "updatedAt", "youtubeThumbnailUrl", "youtubeVideoId") SELECT "createdAt", "customThumbnailPath", "description", "durationText", "id", "isParentRecommended", "isPublished", "originalUrl", "parentRecommendedAt", "playMode", "safetyStatus", "searchKeywords", "thumbnailType", "title", "updatedAt", "youtubeThumbnailUrl", "youtubeVideoId" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_familyId_idx" ON "Video"("familyId");
CREATE UNIQUE INDEX "Video_familyId_youtubeVideoId_key" ON "Video"("familyId", "youtubeVideoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ParentUser_email_key" ON "ParentUser"("email");

-- CreateIndex
CREATE INDEX "ParentUser_familyId_idx" ON "ParentUser"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_code_key" ON "PaymentPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_requestNo_key" ON "PaymentRequest"("requestNo");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_pendingKey_key" ON "PaymentRequest"("pendingKey");

-- CreateIndex
CREATE INDEX "PaymentRequest_familyId_status_idx" ON "PaymentRequest"("familyId", "status");

-- CreateIndex
CREATE INDEX "PaymentRequest_requestedById_requestedAt_idx" ON "PaymentRequest"("requestedById", "requestedAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_requestedAt_idx" ON "PaymentRequest"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySubscription_familyId_key" ON "FamilySubscription"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionGrant_paymentRequestId_key" ON "SubscriptionGrant"("paymentRequestId");

-- CreateIndex
CREATE INDEX "SubscriptionGrant_familyId_status_idx" ON "SubscriptionGrant"("familyId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionGrant_subscriptionId_expiresAt_idx" ON "SubscriptionGrant"("subscriptionId", "expiresAt");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentRequestId_status_idx" ON "PaymentRefund"("paymentRequestId", "status");

-- CreateIndex
CREATE INDEX "PaymentRefund_requestedById_idx" ON "PaymentRefund"("requestedById");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_paymentRequestId_createdAt_idx" ON "PaymentAuditLog"("paymentRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAuditLog_actorType_actorId_idx" ON "PaymentAuditLog"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_action_createdAt_idx" ON "SuperAdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_targetFamilyId_idx" ON "SuperAdminAuditLog"("targetFamilyId");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_targetUserId_idx" ON "SuperAdminAuditLog"("targetUserId");
