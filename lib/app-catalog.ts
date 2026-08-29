import { createHash } from "node:crypto";
import { SafetyStatus, type ThumbnailType } from "@prisma/client";
import { getThumbnailUrl, type ThumbnailSource } from "@/lib/thumbnails";

export type AppCatalogTag = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
};

export type AppCatalogChannel = {
  id: string;
  name: string;
};

export type AppCatalogVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  description: string | null;
  searchKeywords: string | null;
  durationText: string | null;
  thumbnailUrl: string;
  isParentRecommended: boolean;
  parentRecommendedAt: string | null;
  updatedAt: string;
  channel: AppCatalogChannel | null;
  tags: AppCatalogTag[];
};

export type AppCatalog = {
  generatedAt: string;
  version: string;
  videos: AppCatalogVideo[];
};

export type AppCatalogVideoSource = ThumbnailSource & {
  id: string;
  youtubeVideoId: string;
  title: string;
  description: string | null;
  searchKeywords: string | null;
  durationText: string | null;
  thumbnailType: ThumbnailType;
  youtubeThumbnailUrl: string | null;
  customThumbnailPath: string | null;
  isParentRecommended: boolean;
  parentRecommendedAt: Date | null;
  updatedAt: Date;
  channel: {
    id: string;
    displayName: string;
  } | null;
  tags: {
    tag: AppCatalogTag;
  }[];
};

export const APP_CATALOG_VIDEO_WHERE = {
  isPublished: true,
  safetyStatus: SafetyStatus.PARENT_CHECKED,
} as const;

export function buildAppCatalog(videos: AppCatalogVideoSource[], generatedAt = new Date()): AppCatalog {
  const serializedVideos: AppCatalogVideo[] = videos.map((video) => ({
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    description: video.description,
    searchKeywords: video.searchKeywords,
    durationText: video.durationText,
    thumbnailUrl: getThumbnailUrl(video),
    isParentRecommended: video.isParentRecommended,
    parentRecommendedAt: video.parentRecommendedAt?.toISOString() ?? null,
    updatedAt: video.updatedAt.toISOString(),
    channel: video.channel
      ? {
          id: video.channel.id,
          name: video.channel.displayName,
        }
      : null,
    tags: video.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      icon: tag.icon,
    })),
  }));

  return {
    generatedAt: generatedAt.toISOString(),
    version: createCatalogVersion(serializedVideos),
    videos: serializedVideos,
  };
}

export function createCatalogVersion(videos: AppCatalogVideo[]): string {
  return createHash("sha256").update(JSON.stringify(videos)).digest("hex").slice(0, 24);
}
