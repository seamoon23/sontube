import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEALTH_HEADERS = {
  "cache-control": "no-store, max-age=0, must-revalidate",
  pragma: "no-cache",
};

async function canReadDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    console.error("Health check database read failed.");
    return false;
  }
}

export async function GET() {
  if (!(await canReadDatabase())) {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: HEALTH_HEADERS },
    );
  }

  return NextResponse.json({ status: "ok" }, { headers: HEALTH_HEADERS });
}

export async function HEAD() {
  const status = (await canReadDatabase()) ? 200 : 503;
  return new NextResponse(null, { status, headers: HEALTH_HEADERS });
}
