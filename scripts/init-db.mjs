import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(root, "prisma", "dev.db");

const first = run("npx", ["prisma", "db", "push"], { stdio: "inherit" });
if (first.status === 0) {
  process.exit(0);
}

console.warn("prisma db push failed; applying Prisma-generated SQLite SQL as a local fallback.");
mkdirSync(dirname(dbPath), { recursive: true });

if (existsSync(dbPath)) {
  const upgradeStatements = [
    'ALTER TABLE "Video" ADD COLUMN "searchKeywords" TEXT;',
    'ALTER TABLE "Video" ADD COLUMN "isParentRecommended" BOOLEAN NOT NULL DEFAULT false;',
    'ALTER TABLE "Video" ADD COLUMN "parentRecommendedAt" DATETIME;',
    `CREATE TABLE IF NOT EXISTS "KidsVideoSignal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "videoId" TEXT NOT NULL,
      "clientKey" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "KidsVideoSignal_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX IF NOT EXISTS "KidsVideoSignal_videoId_clientKey_type_key" ON "KidsVideoSignal"("videoId", "clientKey", "type");',
    'CREATE INDEX IF NOT EXISTS "KidsVideoSignal_type_idx" ON "KidsVideoSignal"("type");',
    'CREATE INDEX IF NOT EXISTS "KidsVideoSignal_videoId_idx" ON "KidsVideoSignal"("videoId");',
    'CREATE INDEX IF NOT EXISTS "KidsVideoSignal_updatedAt_idx" ON "KidsVideoSignal"("updatedAt");',
  ];

  if (applySqlStatements(upgradeStatements, { ignoreDuplicateColumns: true })) {
    console.warn(`Existing database upgraded: ${dbPath}`);
    process.exit(0);
  }

  process.exit(1);
}

const createStatements = [
  `CREATE TABLE IF NOT EXISTS "Video" (
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
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "Video_youtubeVideoId_key" ON "Video"("youtubeVideoId");',
  `CREATE TABLE IF NOT EXISTS "Tag" (
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
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "Tag_slug_key" ON "Tag"("slug");',
  `CREATE TABLE IF NOT EXISTS "VideoTag" (
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoTag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("videoId", "tagId")
  );`,
  `CREATE TABLE IF NOT EXISTS "KidsVideoSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KidsVideoSignal_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "KidsVideoSignal_videoId_clientKey_type_key" ON "KidsVideoSignal"("videoId", "clientKey", "type");',
  'CREATE INDEX IF NOT EXISTS "KidsVideoSignal_type_idx" ON "KidsVideoSignal"("type");',
  'CREATE INDEX IF NOT EXISTS "KidsVideoSignal_videoId_idx" ON "KidsVideoSignal"("videoId");',
  'CREATE INDEX IF NOT EXISTS "KidsVideoSignal_updatedAt_idx" ON "KidsVideoSignal"("updatedAt");',
  `CREATE TABLE IF NOT EXISTS "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "AppSetting_key_key" ON "AppSetting"("key");',
];

if (applySqlStatements(createStatements, { ignoreDuplicateColumns: false })) {
  console.warn(`New database created: ${dbPath}`);
  process.exit(0);
}

process.exit(1);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
}

function applySqlStatements(statements, { ignoreDuplicateColumns }) {
  for (const statement of statements) {
    const result = run("sqlite3", [dbPath], {
      input: statement,
      stdio: ["pipe", "inherit", "pipe"],
    });

    if (result.status === 0) {
      continue;
    }

    const stderr = result.stderr?.toString() ?? "";
    if (ignoreDuplicateColumns && stderr.includes("duplicate column name")) {
      continue;
    }

    console.error(stderr || `sqlite3 failed with status ${result.status}`);
    return false;
  }

  return true;
}
