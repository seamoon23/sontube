import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SuperAdminLoginForm } from "@/components/superadmin/login-form";
import {
  SUPERADMIN_SESSION_COOKIE,
  isSuperAdminAuthConfigured,
  parseSuperAdminSessionToken,
} from "@/lib/superadmin-auth";

type SuperAdminLoginPageProps = {
  searchParams: Promise<{ setup?: string }>;
};

export default async function SuperAdminLoginPage({ searchParams }: SuperAdminLoginPageProps) {
  const params = await searchParams;
  const configured = isSuperAdminAuthConfigured(process.env);

  if (configured) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SUPERADMIN_SESSION_COOKIE)?.value;
    const session = parseSuperAdminSessionToken(
      token,
      process.env.SUPERADMIN_SESSION_SECRET ?? "",
      process.env.SUPERADMIN_LOGIN_ID?.trim(),
    );
    if (session) redirect("/superadmin");
  }

  return (
    <main className="grid min-h-[100dvh] content-start bg-slate-100 px-4 py-6 sm:content-center sm:py-10">
      <SuperAdminLoginForm setupRequired={params.setup === "1" || !configured} />
    </main>
  );
}
