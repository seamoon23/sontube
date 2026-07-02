import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthConfigured,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";

export async function requireAdminSession(): Promise<void> {
  if (!isAdminAuthConfigured(process.env)) {
    redirect("/admin/login?setup=1");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSessionToken(token, process.env.SESSION_SECRET ?? "")) {
    redirect("/admin/login");
  }
}
