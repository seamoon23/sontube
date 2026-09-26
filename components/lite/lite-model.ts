import type { AppCatalog, AppCatalogVideo } from "@/lib/app-catalog";
import { filterAppCatalogVideos } from "@/lib/app-video-filters";

export const LITE_PLAYLIST_STORAGE_KEY = "sontube:lite-playlist";
export const MAX_LITE_PLAYLIST_ITEMS = 20;
export const LITE_CATALOG_SOURCE = "LIVE" as const;

const CATALOG_VERSION_PATTERN = /^[a-f0-9]{24}$/;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const RFC_3339_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;
const RESPONSE_KEYS = ["ok", "catalog"] as const;
const CATALOG_KEYS = ["source", "generatedAt", "version", "videos"] as const;
const VIDEO_KEYS = [
  "id",
  "youtubeVideoId",
  "title",
  "description",
  "searchKeywords",
  "durationText",
  "thumbnailUrl",
  "isParentRecommended",
  "parentRecommendedAt",
  "updatedAt",
  "channel",
  "tags",
] as const;
const CHANNEL_KEYS = ["id", "name"] as const;
const TAG_KEYS = ["id", "name", "slug", "color", "icon"] as const;

export type LiteTagFacet = { slug: string; name: string; count: number };
export type LiteChannelFacet = { id: string; name: string; count: number };
export type PublicLiteCatalog = AppCatalog & { source: typeof LITE_CATALOG_SOURCE };

export function readLiteCatalogResponse(value: unknown): PublicLiteCatalog | null {
  if (!isRecordWithExactKeys(value, RESPONSE_KEYS)) return null;
  return value.ok === true && isPublicLiteCatalog(value.catalog) ? value.catalog : null;
}

export function filterLiteVideos(
  videos: AppCatalogVideo[],
  query: string,
  selectedTag: string,
  selectedChannelId: string | null,
): AppCatalogVideo[] {
  return filterAppCatalogVideos(videos, query, selectedTag, selectedChannelId);
}

export function buildLiteTagFacets(videos: AppCatalogVideo[]): LiteTagFacet[] {
  const facets = new Map<string, LiteTagFacet>();
  for (const video of videos) {
    for (const tag of video.tags) {
      const current = facets.get(tag.slug) ?? { slug: tag.slug, name: tag.name, count: 0 };
      current.count += 1;
      facets.set(tag.slug, current);
    }
  }
  return Array.from(facets.values()).sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko-KR"),
  );
}

export function buildLiteChannelFacets(videos: AppCatalogVideo[]): LiteChannelFacet[] {
  const facets = new Map<string, LiteChannelFacet>();
  for (const video of videos) {
    if (!video.channel) continue;
    const current = facets.get(video.channel.id) ?? { id: video.channel.id, name: video.channel.name, count: 0 };
    current.count += 1;
    facets.set(video.channel.id, current);
  }
  return Array.from(facets.values()).sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko-KR"),
  );
}

export function normalizeLitePlaylist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === MAX_LITE_PLAYLIST_ITEMS) break;
  }
  return ids;
}

export function toggleLitePlaylist(currentIds: string[], videoId: string): string[] {
  const normalized = normalizeLitePlaylist(currentIds);
  if (normalized.includes(videoId)) return normalized.filter((id) => id !== videoId);
  return [...normalized, videoId].slice(0, MAX_LITE_PLAYLIST_ITEMS);
}

function isPublicLiteCatalog(value: unknown): value is PublicLiteCatalog {
  return isRecordWithExactKeys(value, CATALOG_KEYS) &&
    value.source === LITE_CATALOG_SOURCE &&
    isRfc3339DateTime(value.generatedAt) &&
    typeof value.version === "string" && CATALOG_VERSION_PATTERN.test(value.version) &&
    Array.isArray(value.videos) && value.videos.every(isAppCatalogVideo);
}

function isAppCatalogVideo(value: unknown): value is AppCatalogVideo {
  return isRecordWithExactKeys(value, VIDEO_KEYS) &&
    isNonEmptyString(value.id) &&
    typeof value.youtubeVideoId === "string" && YOUTUBE_VIDEO_ID_PATTERN.test(value.youtubeVideoId) &&
    isNonEmptyString(value.title) &&
    isNullableString(value.description) &&
    isNullableString(value.searchKeywords) &&
    isNullableString(value.durationText) &&
    isNonEmptyString(value.thumbnailUrl) &&
    typeof value.isParentRecommended === "boolean" &&
    (value.parentRecommendedAt === null || isRfc3339DateTime(value.parentRecommendedAt)) &&
    isRfc3339DateTime(value.updatedAt) &&
    isChannel(value.channel) &&
    Array.isArray(value.tags) && value.tags.every(isTag);
}

function isChannel(value: unknown): value is AppCatalogVideo["channel"] {
  if (value === null) return true;
  return isRecordWithExactKeys(value, CHANNEL_KEYS) && isNonEmptyString(value.id) && isNonEmptyString(value.name);
}

function isTag(value: unknown): value is AppCatalogVideo["tags"][number] {
  return isRecordWithExactKeys(value, TAG_KEYS) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.slug) &&
    isNullableString(value.color) &&
    isNullableString(value.icon);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecordWithExactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = RFC_3339_DATE_TIME_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);

  return month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth(year, month) &&
    hour <= 23 && minute <= 59 && second <= 60 &&
    offsetHour <= 23 && offsetMinute <= 59;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
