import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { parentToken: undefined as string | undefined };
  const cookieGet = vi.fn((name: string) =>
    name === "sontube_admin_session" && state.parentToken
      ? { value: state.parentToken }
      : undefined,
  );
  const cookieSet = vi.fn();
  const auditCreate = vi.fn();
  const parentFindUnique = vi.fn();
  const parentFindFirst = vi.fn();
  const parentUpdate = vi.fn();
  const parentUpdateMany = vi.fn();
  const familyFindUnique = vi.fn();
  const familyUpdate = vi.fn();
  const transaction = vi.fn();

  return {
    state,
    cookieGet,
    cookieSet,
    auditCreate,
    parentFindUnique,
    parentFindFirst,
    parentUpdate,
    parentUpdateMany,
    familyFindUnique,
    familyUpdate,
    transaction,
    cookies: vi.fn(),
    headers: vi.fn(),
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
    requireSuperAdminSession: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    parentUser: {
      findUnique: mocks.parentFindUnique,
      findFirst: mocks.parentFindFirst,
      update: mocks.parentUpdate,
    },
    superAdminAuditLog: {
      create: mocks.auditCreate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/superadmin-session", () => ({
  requireSuperAdminSession: mocks.requireSuperAdminSession,
}));

import { loginAdminAction, logoutAdminAction } from "@/app/admin/login/actions";
import { GET as getAdminContext } from "@/app/api/admin/context/route";
import {
  endImpersonationAction,
  logoutSuperAdminAction,
  toggleFamilyActiveAction,
} from "@/app/superadmin/actions";
import {
  ADMIN_SESSION_COOKIE,
  createImpersonatedAdminSessionToken,
  hashAdminPassword,
} from "@/lib/admin-auth";
import { requireAdminSession } from "@/lib/admin-session";
import { SUPERADMIN_SESSION_COOKIE } from "@/lib/superadmin-auth";

const SESSION_SECRET = "test-parent-session-secret";
const originalSessionSecret = process.env.SESSION_SECRET;
const originalAllowedEmails = process.env.ADMIN_ALLOWED_EMAILS;

describe("admin session lifecycle actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.state.parentToken = undefined;
    process.env.SESSION_SECRET = SESSION_SECRET;
    process.env.ADMIN_ALLOWED_EMAILS = "parent@example.com,partner@example.com";
    mocks.cookieGet.mockImplementation((name: string) =>
      name === ADMIN_SESSION_COOKIE && mocks.state.parentToken
        ? { value: mocks.state.parentToken }
        : undefined,
    );
    mocks.cookies.mockResolvedValue({ get: mocks.cookieGet, set: mocks.cookieSet });
    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" }));
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    mocks.requireSuperAdminSession.mockResolvedValue({ loginId: "owner" });
    mocks.auditCreate.mockResolvedValue({ id: "audit_1" });
    mocks.parentFindFirst.mockResolvedValue(null);
    mocks.parentUpdate.mockResolvedValue({ id: "parent_1" });
    mocks.familyFindUnique.mockResolvedValue({ id: "family_1", isActive: true });
    mocks.familyUpdate.mockResolvedValue({ id: "family_1", isActive: false });
    mocks.parentUpdateMany.mockResolvedValue({ count: 2 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        family: { findUnique: mocks.familyFindUnique, update: mocks.familyUpdate },
        parentUser: { updateMany: mocks.parentUpdateMany },
        superAdminAuditLog: { create: mocks.auditCreate },
      }),
    );
  });

  afterAll(() => {
    restoreEnvironment("SESSION_SECRET", originalSessionSecret);
    restoreEnvironment("ADMIN_ALLOWED_EMAILS", originalAllowedEmails);
  });

  it("clears both owner and impersonated parent cookies on owner logout", async () => {
    await expect(logoutSuperAdminAction()).rejects.toThrow("redirect:/superadmin/login");

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      SUPERADMIN_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
  });

  it("clears an impersonation cookie before a best-effort end audit", async () => {
    mocks.state.parentToken = createImpersonationToken();
    mocks.auditCreate.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(endImpersonationAction()).rejects.toThrow(
      "redirect:/superadmin/users?notice=",
    );

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
    expect(mocks.cookieSet.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.auditCreate.mock.invocationCallOrder[0],
    );
  });

  it("clears a parent cookie even when the logout audit fails", async () => {
    mocks.state.parentToken = createImpersonationToken();
    mocks.auditCreate.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(logoutAdminAction()).rejects.toThrow(
      "redirect:/superadmin/users?notice=",
    );

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
    expect(mocks.cookieSet.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.auditCreate.mock.invocationCallOrder[0],
    );
  });

  it("finishes a normal login when replacing an impersonation cookie audit fails", async () => {
    mocks.state.parentToken = createImpersonationToken();
    mocks.parentFindUnique.mockResolvedValue({
      id: "parent_1",
      familyId: "family_1",
      email: "parent@example.com",
      displayName: "보호자",
      passwordHash: hashAdminPassword("correct-password", SESSION_SECRET),
      sessionVersion: 3,
      isActive: true,
      family: { isActive: true },
    });
    mocks.auditCreate.mockRejectedValueOnce(new Error("audit unavailable"));
    const formData = new FormData();
    formData.set("email", "parent@example.com");
    formData.set("password", "correct-password");

    await expect(loginAdminAction(formData)).rejects.toThrow("redirect:/admin");

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 7 }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "IMPERSONATION_ENDED",
        metadataJson: JSON.stringify({ endedFrom: "parent_login" }),
      }),
    });
  });

  it("runs a disallowed login through the database lookup before returning the generic error", async () => {
    mocks.parentFindUnique.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("email", "outsider@example.com");
    formData.set("password", "wrong-password");

    await expect(loginAdminAction(formData)).resolves.toEqual({
      ok: false,
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });

    expect(mocks.parentFindUnique).toHaveBeenCalledWith({
      where: { email: "outsider@example.com" },
      include: { family: { select: { isActive: true } } },
    });
  });

  it("rejects a signed cookie when the database session version has advanced", async () => {
    mocks.state.parentToken = createImpersonationToken();
    mocks.parentFindFirst.mockResolvedValue({
      id: "parent_1",
      familyId: "family_1",
      email: "parent@example.com",
      displayName: "보호자",
      sessionVersion: 3,
    });

    await expect(requireAdminSession()).rejects.toThrow("redirect:/admin/login");
  });

  it("includes the signed session version in the admin context database check", async () => {
    mocks.state.parentToken = createImpersonationToken();

    const response = await getAdminContext();

    expect(response.status).toBe(401);
    expect(mocks.parentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionVersion: 2 }),
      }),
    );
  });

  it("increments every family user's session version on a family status toggle", async () => {
    const formData = new FormData();
    formData.set("familyId", "family_1");

    await expect(toggleFamilyActiveAction(formData)).rejects.toThrow(
      "redirect:/superadmin/users?notice=",
    );

    expect(mocks.parentUpdateMany).toHaveBeenCalledWith({
      where: { familyId: "family_1" },
      data: { sessionVersion: { increment: 1 } },
    });
  });
});

function createImpersonationToken(): string {
  return createImpersonatedAdminSessionToken(
    SESSION_SECRET,
    {
      userId: "parent_1",
      familyId: "family_1",
      email: "parent@example.com",
      displayName: "보호자",
      sessionVersion: 2,
    },
    "owner",
  );
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
