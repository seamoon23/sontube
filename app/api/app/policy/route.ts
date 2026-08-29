import { NextResponse } from "next/server";
import { getAppPolicyByInstallationId } from "@/lib/app-policy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const installationId = new URL(request.url).searchParams.get("installationId");
  const policy = await getAppPolicyByInstallationId(installationId);

  return NextResponse.json(
    { ok: true, policy },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}