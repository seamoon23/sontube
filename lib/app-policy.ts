import { prisma } from "@/lib/db";

export const APP_WIFI_REQUIRED_SETTING_KEY = "wifi_required";

export type AppPolicy = {
  wifiRequired: boolean;
};

export const DEFAULT_APP_POLICY: AppPolicy = {
  wifiRequired: true,
};

export function parseWifiRequiredSetting(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "false" ? false : DEFAULT_APP_POLICY.wifiRequired;
}

export async function getAppPolicy(familyId?: string | null): Promise<AppPolicy> {
  if (!familyId) return DEFAULT_APP_POLICY;

  const family = await prisma.family.findFirst({
    where: { id: familyId, isActive: true },
    select: { wifiRequired: true },
  });

  return family ? { wifiRequired: family.wifiRequired } : DEFAULT_APP_POLICY;
}

export async function getAppPolicyByInstallationId(installationId?: string | null): Promise<AppPolicy> {
  const normalized = installationId?.trim() ?? "";
  if (!/^[a-zA-Z0-9:_-]{16,120}$/.test(normalized)) return DEFAULT_APP_POLICY;

  const accessKey = await prisma.appAccessKey.findUnique({
    where: { installationId: normalized },
    select: { familyId: true },
  });

  return getAppPolicy(accessKey?.familyId);
}