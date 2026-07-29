import { z } from "zod";
import {
  APP_ACCESS_SYNC_INTERVAL_HOURS,
  getAppAccessState,
  getNextRecommendedSyncAt,
  hashAppAccessKey,
  makeAppKeyPrefix,
  normalizeAppAccessKey,
  type AppAccessState,
} from "@/lib/app-access";
import { APP_CATALOG_VIDEO_WHERE, buildAppCatalog, type AppCatalog } from "@/lib/app-catalog";
import { prisma } from "@/lib/db";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export const appSyncRequestSchema = z.object({
  key: z.string().trim().min(20).max(200),
  installationId: z
    .string()
    .trim()
    .min(16)
    .max(120)
    .regex(/^[a-zA-Z0-9:_-]+$/),
  force: z.boolean().optional().default(false),
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
  const rateKey = `${options.requestIdentifier ?? "local"}:${makeAppKeyPrefix(key)}`;
  if (!checkRateLimit(rateKey, now)) {
    return {
      ok: false,
      status: 429,
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const accessKey = await prisma.appAccessKey.findUnique({
    where: { keyHash: hashAppAccessKey(key) },
  });

  if (!accessKey) {
    return {
      ok: false,
      status: 401,
      message: "등록되지 않은 앱 키입니다.",
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

  const accessState = getAppAccessState(accessKey, now);

  if (!accessState.canSync) {
    return {
      ok: true,
      message: accessState.status === "expired" ? "무료 체험 기간이 종료되었습니다." : "비활성화된 앱 키입니다.",
      access: toAppSyncAccess(accessKey, accessState, accessKey.lastSyncedAt, now),
      catalog: buildAppCatalog([], now),
    };
  }

  if (options.mode === "sync" && !parsed.data.force && isWithinSyncInterval(accessKey.lastSyncedAt, now)) {
    return {
      ok: true,
      message: `${APP_ACCESS_SYNC_INTERVAL_HOURS}시간 안에 이미 동기화했습니다. 저장된 목록을 계속 사용합니다.`,
      access: toAppSyncAccess(accessKey, accessState, accessKey.lastSyncedAt, now),
      catalog: null,
    };
  }

  const videos = await prisma.video.findMany({
    where: APP_CATALOG_VIDEO_WHERE,
    include: {
      tags: {
        where: { tag: { isActive: true } },
        include: { tag: true },
        orderBy: { tag: { sortOrder: "asc" } },
      },
    },
    orderBy: [{ isParentRecommended: "desc" }, { parentRecommendedAt: "desc" }, { updatedAt: "desc" }],
  });

  const updatedAccessKey = await prisma.appAccessKey.update({
    where: { id: accessKey.id },
    data: {
      installationId: binding.shouldBindInstallation ? parsed.data.installationId : accessKey.installationId,
      registeredAt: binding.shouldBindInstallation ? now : accessKey.registeredAt,
      lastSyncedAt: now,
    },
  });

  return {
    ok: true,
    message: options.mode === "register" ? "앱 키를 등록하고 콘텐츠를 동기화했습니다." : "콘텐츠를 동기화했습니다.",
    access: toAppSyncAccess(updatedAccessKey, accessState, now, now),
    catalog: buildAppCatalog(videos, now),
  };
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
    trialEndsAt: Date;
    paidUntil: Date | null;
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

function checkRateLimit(identifier: string, now: Date): boolean {
  const currentTime = now.getTime();
  const bucket = rateLimitBuckets.get(identifier);

  if (!bucket || bucket.resetAt <= currentTime) {
    rateLimitBuckets.set(identifier, { count: 1, resetAt: currentTime + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function isWithinSyncInterval(lastSyncedAt: Date | null, now: Date): boolean {
  if (!lastSyncedAt) return false;
  const intervalMs = APP_ACCESS_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;
  return now.getTime() - lastSyncedAt.getTime() < intervalMs;
}