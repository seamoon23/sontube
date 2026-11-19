import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthConfigured,
  parseAdminSessionToken,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminAuthConfigured(process.env)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const cookieStore = await cookies();
  const session = parseAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  );

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const user = await prisma.parentUser.findFirst({
    where: {
      id: session.userId,
      familyId: session.familyId,
      sessionVersion: session.sessionVersion,
      isActive: true,
      family: { is: { isActive: true } },
    },
    select: { displayName: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json(
    {
      ok: true,
      displayName: user.displayName,
      impersonatedBy: session.impersonatedBy ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
