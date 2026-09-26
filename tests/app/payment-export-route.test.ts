import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireSuperAdminSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { paymentRequest: { findMany: mocks.findMany } },
}));

vi.mock("@/lib/superadmin-session", () => ({
  requireSuperAdminSession: mocks.requireSuperAdminSession,
}));

import { GET } from "@/app/api/superadmin/payments/export/route";

describe("superadmin payment reconciliation export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperAdminSession.mockResolvedValue({ loginId: "owner" });
    mocks.findMany.mockResolvedValue([
      {
        requestNo: "PAY-20260926-001",
        status: "REFUNDED",
        planCodeSnapshot: "YEAR",
        planNameSnapshot: "1년 이용권",
        amountKrw: 50000,
        durationDaysSnapshot: 365,
        depositorName: "=DANGEROUS",
        expectedDepositDate: "2026-09-26",
        requestedAt: new Date("2026-09-25T15:00:00.000Z"),
        confirmedAt: new Date("2026-09-26T01:00:00.000Z"),
        confirmedBy: "owner",
        receivedAmountKrw: 50000,
        receivedDate: "2026-09-26",
        rejectedBy: null,
        refundRequestedAt: new Date("2026-09-27T01:00:00.000Z"),
        refundedAt: new Date("2026-09-27T02:00:00.000Z"),
        refundedBy: "owner",
        refundAmountKrw: 50000,
        family: { name: '테스트, "가족"' },
        requestedBy: { displayName: "보호자", email: "parent@example.com" },
      },
    ]);
  });

  it("requires the final administrator and returns a no-store UTF-8 CSV", async () => {
    const response = await GET();
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    const body = await response.text();

    expect(mocks.requireSuperAdminSession).toHaveBeenCalledOnce();
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="sontube-payments-\d{4}-\d{2}-\d{2}\.csv"/u);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body).toContain('"PAY-20260926-001","REFUNDED"');
    expect(body).toContain('"테스트, ""가족"""');
    expect(body).toContain('"\'=DANGEROUS"');
    expect(body).not.toContain('"=DANGEROUS"');
  });

  it("exports only reconciliation fields without free-form memos or internal identifiers", async () => {
    await GET();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
        select: expect.not.objectContaining({
          id: true,
          adminMemo: true,
          userMemo: true,
        }),
      }),
    );
  });

  it("does not read payment data when final administrator authentication fails", async () => {
    mocks.requireSuperAdminSession.mockRejectedValueOnce(new Error("redirect:/superadmin/login"));

    await expect(GET()).rejects.toThrow("redirect:/superadmin/login");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
