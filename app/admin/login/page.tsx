import { isAdminAuthConfigured } from "@/lib/admin-auth";
import { LoginForm } from "@/components/admin/login-form";

type AdminLoginPageProps = {
  searchParams: Promise<{
    setup?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const setupRequired = params.setup === "1" || !isAdminAuthConfigured(process.env);

  return (
    <div className="w-full">
      <LoginForm setupRequired={setupRequired} />
    </div>
  );
}
