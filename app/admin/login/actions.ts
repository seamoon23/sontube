"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isAdminAuthConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export type LoginResult = {
  ok: boolean;
  message: string;
};

export async function loginAdminAction(formData: FormData): Promise<LoginResult> {
  if (!isAdminAuthConfigured(process.env)) {
    return {
      ok: false,
      message: "관리자 비밀번호 해시와 세션 비밀키가 설정되어 있지 않습니다.",
    };
  }

  const password = String(formData.get("password") ?? "");
  const isValid = verifyAdminPassword(
    password,
    process.env.ADMIN_PASSWORD_HASH ?? "",
    process.env.SESSION_SECRET ?? "",
  );

  if (!isValid) {
    return {
      ok: false,
      message: "비밀번호가 올바르지 않습니다.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(process.env.SESSION_SECRET ?? ""), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/admin",
  });

  redirect("/admin");
}

export async function logoutAdminAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
