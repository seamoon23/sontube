import { isAdminAuthConfigured } from "@/lib/admin-auth";
import { LoginForm } from "@/components/admin/login-form";
import { prisma } from "@/lib/db";

type AdminLoginPageProps = {
  searchParams: Promise<{
    setup?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const hasParentUser = (await prisma.parentUser.count({ where: { isActive: true } })) > 0;
  const setupRequired = params.setup === "1" || !isAdminAuthConfigured(process.env) || !hasParentUser;

  return (
    <main className="w-full">
      <LoginForm setupRequired={setupRequired} />
    </main>
  );
}
