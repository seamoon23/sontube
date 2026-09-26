import { SafetyStatus } from "@prisma/client";
import {
  buildAppCatalog,
  type AppCatalog,
  type AppCatalogVideoSource,
} from "@/lib/app-catalog";
import { prisma } from "@/lib/db";

export const LITE_CATALOG_SOURCE = "LIVE" as const;
export const LITE_CATALOG_CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";

export const LITE_CATALOG_VIDEO_WHERE = {
  isLitePublished: true,
  isPublished: true,
  safetyStatus: SafetyStatus.PARENT_CHECKED,
  family: { is: { isActive: true } },
} as const;

export const LITE_CATALOG_VIDEO_ORDER_BY = [
  { liteSortOrder: "asc" as const },
  { updatedAt: "desc" as const },
  { id: "asc" as const },
];

export type LiteCatalog = AppCatalog & {
  source: typeof LITE_CATALOG_SOURCE;
};

export async function getLiteCatalog(generatedAt = new Date()): Promise<LiteCatalog> {
  const videos = await prisma.video.findMany({
    where: LITE_CATALOG_VIDEO_WHERE,
    include: {
      channel: { select: { id: true, displayName: true } },
      tags: {
        where: { tag: { isActive: true } },
        include: { tag: true },
        orderBy: { tag: { sortOrder: "asc" } },
      },
    },
    orderBy: LITE_CATALOG_VIDEO_ORDER_BY,
  });

  return buildLiteCatalog(videos, generatedAt);
}

export function buildLiteCatalog(videos: AppCatalogVideoSource[], generatedAt = new Date()): LiteCatalog {
  return {
    source: LITE_CATALOG_SOURCE,
    ...buildAppCatalog(videos, generatedAt),
  };
}

export function createLiteCatalogEtag(catalog: Pick<LiteCatalog, "version">): string {
  // generatedAt changes for a freshly projected response while the catalog
  // videos can remain semantically identical, so this validator is weak.
  return `W/"lite-${catalog.version}"`;
}

export function matchesLiteCatalogEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;

  return ifNoneMatch.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || stripWeakPrefix(normalized) === stripWeakPrefix(etag);
  });
}

function stripWeakPrefix(value: string): string {
  return value.replace(/^W\//, "");
}
