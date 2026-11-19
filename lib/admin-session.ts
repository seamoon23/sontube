import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthConfigured,
  parseAdminSessionToken,
  type AdminSessionPayload,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export type AdminSessionContext = AdminSessionPayload;

export async function requireAdminSession(): Promise<AdminSessionContext> {
  if (!isAdminAuthConfigured(process.env)) {
    redirect("/admin/login?setup=1");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = parseAdminSessionToken(token, process.env.SESSION_SECRET ?? "");

  if (!session) {
    redirect("/admin/login");
  }

  const user = await prisma.parentUser.findFirst({
    where: {
      id: session.userId,
      familyId: session.familyId,
      isActive: true,
      family: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      familyId: true,
      email: true,
      displayName: true,
      sessionVersion: true,
    },
  });

  if (
    !user ||
    user.sessionVersion !== session.sessionVersion
  ) {
    redirect("/admin/login");
  }

  return {
    userId: user.id,
    familyId: user.familyId,
    email: user.email,
    displayName: user.displayName,
    sessionVersion: user.sessionVersion,
    ...(session.impersonatedBy ? { impersonatedBy: session.impersonatedBy } : {}),
    issuedAt: session.issuedAt,
  };
}
