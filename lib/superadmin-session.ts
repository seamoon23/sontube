import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SUPERADMIN_SESSION_COOKIE,
  isSuperAdminAuthConfigured,
  parseSuperAdminSessionToken,
  type SuperAdminSessionPayload,
} from "@/lib/superadmin-auth";

export type SuperAdminSessionContext = SuperAdminSessionPayload;

export async function requireSuperAdminSession(): Promise<SuperAdminSessionContext> {
  if (!isSuperAdminAuthConfigured(process.env)) {
    redirect("/superadmin/login?setup=1");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SUPERADMIN_SESSION_COOKIE)?.value;
  const loginId = process.env.SUPERADMIN_LOGIN_ID?.trim() ?? "";
  const session = parseSuperAdminSessionToken(
    token,
    process.env.SUPERADMIN_SESSION_SECRET ?? "",
    loginId,
  );

  if (!session) {
    redirect("/superadmin/login");
  }

  return session;
}
