import { NextResponse } from "next/server";
import { buildAppSyncResult } from "@/lib/app-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "요청 형식을 확인해 주세요." }, { status: 400 });
  }

  const result = await buildAppSyncResult(body, {
    mode: "register",
    requestIdentifier: getRequestIdentifier(request),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json(result);
}

function getRequestIdentifier(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}