import { z } from "zod";
import { createHash } from "node:crypto";
import {
  getAppAccessState,
  getNextRecommendedSyncAt,
  hashAppAccessKey,
  makeAppKeyPrefix,
  normalizeAppAccessKey,
  type AppAccessState,
} from "@/lib/app-access";
import { APP_CATALOG_VIDEO_WHERE, buildAppCatalog, type AppCatalog } from "@/lib/app-catalog";
import type { AppPolicy } from "@/lib/app-policy";
import { prisma } from "@/lib/db";
import {
  createHashedRateLimitIdentifier,
  ProcessLocalFixedWindowRateLimiter,
} from "@/lib/rate-limit";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const appSyncRateLimiter = new ProcessLocalFixedWindowRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  maxBuckets: 5_000,
});

export const appSyncRequestSchema = z.object({
  key: z.string().trim().min(20).max(200),
  installationId: z
    .string()
    .trim()
    .min(16)
    .max(120)
    .regex(/^[a-zA-Z0-9:_-]+$/),
  catalogVersion: z.string().trim().min(1).max(120).optional(),
  force: z.boolean().optional(),
});

export type AppSyncMode = "register" | "sync";

export type AppSyncAccess = AppAccessState & {
  keyPrefix: string;
  lastSyncedAt: string | null;
  nextRecommendedSyncAt: string;
};

export type AppSyncResult =
  | {
      ok: true;
      message: string;
      access: AppSyncAccess;
      policy: AppPolicy;
      catalog: AppCatalog | null;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export async function buildAppSyncResult(
  input: unknown,
  options: { mode: AppSyncMode; requestIdentifier?: string; now?: Date },
): Promise<AppSyncResult> {
  const now = options.now ?? new Date();
  const parsed = appSyncRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: "앱 키와 설치 정보를 확인해 주세요.",
    };
  }

  const key = normalizeAppAccessKey(parsed.data.key);
  const rateKey = createHashedRateLimitIdentifier([
    options.requestIdentifier ?? "local",
    makeAppKeyPrefix(key),
  ]);
  if (!appSyncRateLimiter.allow(rateKey, now.getTime())) {
    return {
      ok: false,
      status: 429,
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  // One snapshot prevents a new revision from being paired with an older catalog or binding.
  return prisma.$transaction(async (tx): Promise<AppSyncResult> => {
    const accessKey = await tx.appAccessKey.findUnique({
      where: { keyHash: hashAppAccessKey(key) },
      include: { family: { select: { isActive: true, wifiRequired: true, catalogRevision: true } } },
    });

    if (!accessKey) {
      return {
        ok: false,
        status: 401,
        message: "등록되지 않은 앱 키입니다.",
      };
    }

    if (!accessKey.familyId || !accessKey.family?.isActive) {
      return {
        ok: false,
        status: 403,
        message: "사용할 수 없는 가족 앱 키입니다.",
      };
    }

    const binding = validateInstallationBinding({
      mode: options.mode,
      currentInstallationId: accessKey.installationId,
      requestedInstallationId: parsed.data.installationId,
    });

    if (!binding.ok) {
      return binding;
    }

    const accessState = getAppAccessState(accessKey);
    const policy: AppPolicy = { wifiRequired: accessKey.family.wifiRequired };

    if (!accessState.canSync) {
      return {
        ok: false,
        status: 403,
        message: "비활성화된 앱 키입니다.",
      };
    }

    const version = createHash("sha256")
      .update(`family-catalog-v1:${accessKey.familyId}:${accessKey.family.catalogRevision}`)
      .digest("hex").slice(0, 24);
    const catalogIsCurrent = options.mode === "sync" && !parsed.data.force && parsed.data.catalogVersion === version;
    let catalog: AppCatalog | null = null;
    if (!catalogIsCurrent) {
      const videos = await tx.video.findMany({
        where: { ...APP_CATALOG_VIDEO_WHERE, familyId: accessKey.familyId },
        include: {
          channel: { select: { id: true, displayName: true } },
          tags: {
            where: { tag: { familyId: accessKey.familyId, isActive: true } },
            include: { tag: true },
            orderBy: [{ tag: { sortOrder: "asc" } }, { tagId: "asc" }],
          },
        },
        orderBy: [{ isParentRecommended: "desc" }, { parentRecommendedAt: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
      });
      catalog = { ...buildAppCatalog(videos, now), version };
    }

    if (binding.shouldBindInstallation) {
      await tx.appAccessKey.updateMany({
        where: {
          installationId: parsed.data.installationId,
          id: { not: accessKey.id },
        },
        data: { installationId: null, registeredAt: null },
      });
    }

    // Avoid a DB write for repeated focus events; the response still records this successful check.
    if (binding.shouldBindInstallation || !accessKey.lastSyncedAt || now.getTime() - accessKey.lastSyncedAt.getTime() >= 300_000) {
      await tx.appAccessKey.update({
        where: { id: accessKey.id },
        data: {
          installationId: binding.shouldBindInstallation ? parsed.data.installationId : accessKey.installationId,
          registeredAt: binding.shouldBindInstallation ? now : accessKey.registeredAt,
          lastSyncedAt: now,
        },
      });
    }

    return {
      ok: true,
      message:
        options.mode === "register"
          ? "앱 키를 등록하고 콘텐츠를 동기화했습니다."
          : catalogIsCurrent
            ? "승인 목록이 최신입니다."
            : "새 승인 목록을 동기화했습니다.",
      access: toAppSyncAccess(accessKey, accessState, now, now),
      policy,
      catalog,
    };
  });
}

function validateInstallationBinding({
  mode,
  currentInstallationId,
  requestedInstallationId,
}: {
  mode: AppSyncMode;
  currentInstallationId: string | null;
  requestedInstallationId: string;
}): { ok: true; shouldBindInstallation: boolean } | { ok: false; status: number; message: string } {
  if (!currentInstallationId) {
    if (mode === "sync") {
      return {
        ok: false,
        status: 409,
        message: "먼저 앱 키를 등록해 주세요.",
      };
    }

    return { ok: true, shouldBindInstallation: true };
  }

  if (currentInstallationId !== requestedInstallationId) {
    return {
      ok: false,
      status: 403,
      message: "이 앱 키는 이미 다른 앱에 등록되어 있습니다. 관리자 화면에서 새 키를 만들어 주세요.",
    };
  }

  return { ok: true, shouldBindInstallation: false };
}

function toAppSyncAccess(
  accessKey: {
    keyPrefix: string;
  },
  state: AppAccessState,
  lastSyncedAt: Date | null,
  now: Date,
): AppSyncAccess {
  return {
    ...state,
    keyPrefix: accessKey.keyPrefix,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    nextRecommendedSyncAt: getNextRecommendedSyncAt(lastSyncedAt, now),
  };
}
