-- Keep existing videos and historical payment/trial records intact.
ALTER TABLE "Family" ADD COLUMN "videoLimit" INTEGER NOT NULL DEFAULT 20
  CHECK (typeof("videoLimit") = 'integer' AND "videoLimit" BETWEEN 20 AND 100000);
ALTER TABLE "Family" ADD COLUMN "catalogRevision" INTEGER NOT NULL DEFAULT 0;

-- Enforce the cap even for concurrent requests and future import paths.
CREATE TRIGGER "Video_limit_insert" BEFORE INSERT ON "Video"
WHEN NEW."familyId" IS NOT NULL AND
  (SELECT COUNT(*) FROM "Video" WHERE "familyId" = NEW."familyId") >=
  (SELECT "videoLimit" FROM "Family" WHERE "id" = NEW."familyId")
BEGIN
  SELECT RAISE(ABORT, 'family_video_limit');
END;
CREATE TRIGGER "Video_limit_move" BEFORE UPDATE OF "familyId" ON "Video"
WHEN NEW."familyId" IS NOT OLD."familyId" AND NEW."familyId" IS NOT NULL AND
  (SELECT COUNT(*) FROM "Video" WHERE "familyId" = NEW."familyId") >=
  (SELECT "videoLimit" FROM "Family" WHERE "id" = NEW."familyId")
BEGIN
  SELECT RAISE(ABORT, 'family_video_limit');
END;

CREATE TRIGGER "Video_catalog_insert" AFTER INSERT ON "Video"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT NEW."familyId");
END;

CREATE TRIGGER "Video_catalog_update" AFTER UPDATE ON "Video"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT OLD."familyId" UNION SELECT NEW."familyId");
END;

CREATE TRIGGER "Video_catalog_delete" AFTER DELETE ON "Video"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT OLD."familyId");
END;

CREATE TRIGGER "Tag_catalog_update" AFTER UPDATE OF "name", "slug", "color", "icon", "isActive", "sortOrder", "familyId" ON "Tag"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT OLD."familyId" UNION SELECT NEW."familyId");
END;

CREATE TRIGGER "Tag_catalog_delete" AFTER DELETE ON "Tag"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT OLD."familyId");
END;

CREATE TRIGGER "Channel_catalog_update" AFTER UPDATE OF "displayName", "familyId" ON "Channel"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT OLD."familyId" UNION SELECT NEW."familyId");
END;

CREATE TRIGGER "Channel_catalog_delete" AFTER DELETE ON "Channel"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT OLD."familyId");
END;

CREATE TRIGGER "VideoTag_catalog_insert" AFTER INSERT ON "VideoTag"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT "familyId" FROM "Video" WHERE "id" = NEW."videoId");
END;

CREATE TRIGGER "VideoTag_catalog_update" AFTER UPDATE ON "VideoTag"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT "familyId" FROM "Video" WHERE "id" = OLD."videoId" UNION SELECT "familyId" FROM "Video" WHERE "id" = NEW."videoId");
END;

CREATE TRIGGER "VideoTag_catalog_delete" AFTER DELETE ON "VideoTag"
BEGIN
  UPDATE "Family" SET "catalogRevision" = "catalogRevision" + 1 WHERE "id" IN (SELECT "familyId" FROM "Video" WHERE "id" = OLD."videoId");
END;
