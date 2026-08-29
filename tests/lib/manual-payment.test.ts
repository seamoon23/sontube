import { describe, expect, it } from "vitest";
import {
  calculateManualPaymentPeriod,
  canTransitionManualPaymentStatus,
  createManualPaymentRequestNumber,
  getManualPaymentStatusLabel,
  MAX_DEPOSITOR_NAME_LENGTH,
  MAX_MANUAL_PAYMENT_KRW,
  parseDepositorName,
  parseExpectedDepositDate,
  parseKrwAmount,
  type ManualPaymentStatus,
} from "@/lib/manual-payment";

describe("manual payment status", () => {
  it("returns a parent-facing label for every stored status", () => {
    const labels: Record<ManualPaymentStatus, string> = {
      PENDING: "입금 확인 대기",
      CONFIRMED: "입금 확인 완료",
      REJECTED: "확인 불가",
      EXPIRED: "신청 만료",
      REFUND_REQUESTED: "환불 요청 접수",
      REFUNDED: "환불 완료",
      PARTIAL_REFUNDED: "일부 환불 완료",
    };

    for (const [status, label] of Object.entries(labels)) {
      expect(getManualPaymentStatusLabel(status as ManualPaymentStatus)).toBe(label);
    }
  });

  it("allows only the explicit manual processing transitions", () => {
    expect(canTransitionManualPaymentStatus("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionManualPaymentStatus("PENDING", "REJECTED")).toBe(true);
    expect(canTransitionManualPaymentStatus("PENDING", "EXPIRED")).toBe(true);
    expect(canTransitionManualPaymentStatus("CONFIRMED", "REFUND_REQUESTED")).toBe(true);
    expect(canTransitionManualPaymentStatus("REFUND_REQUESTED", "CONFIRMED")).toBe(true);
    expect(canTransitionManualPaymentStatus("REFUND_REQUESTED", "REFUNDED")).toBe(true);

    expect(canTransitionManualPaymentStatus("CONFIRMED", "CONFIRMED")).toBe(false);
    expect(canTransitionManualPaymentStatus("REJECTED", "CONFIRMED")).toBe(false);
    expect(canTransitionManualPaymentStatus("EXPIRED", "CONFIRMED")).toBe(false);
    expect(canTransitionManualPaymentStatus("REFUNDED", "CONFIRMED")).toBe(false);
    expect(canTransitionManualPaymentStatus("CONFIRMED", "PARTIAL_REFUNDED")).toBe(false);
    expect(canTransitionManualPaymentStatus("PARTIAL_REFUNDED", "REFUNDED")).toBe(false);
  });
});

describe("manual payment input validation", () => {
  it("accepts safe integer KRW values from numbers or strict digit strings", () => {
    expect(parseKrwAmount(39_000)).toEqual({ ok: true, value: 39_000 });
    expect(parseKrwAmount(" 39000 ")).toEqual({ ok: true, value: 39_000 });
    expect(parseKrwAmount(String(MAX_MANUAL_PAYMENT_KRW))).toEqual({
      ok: true,
      value: MAX_MANUAL_PAYMENT_KRW,
    });
  });

  it("rejects zero, decimals, separators, exponents, and excessive KRW values", () => {
    for (const value of [
      0,
      -1,
      39_000.5,
      "39,000",
      "39000원",
      "3.9e4",
      "",
      MAX_MANUAL_PAYMENT_KRW + 1,
    ]) {
      expect(parseKrwAmount(value).ok).toBe(false);
    }
  });

  it("normalizes an entered depositor name without over-restricting legitimate names", () => {
    expect(parseDepositorName("  엄   동건  ")).toEqual({ ok: true, value: "엄 동건" });
    expect(parseDepositorName("ＳｏｎＴｕｂｅ 주식회사")).toEqual({
      ok: true,
      value: "SonTube 주식회사",
    });
    expect(parseDepositorName("김-보호자(가족)")).toEqual({
      ok: true,
      value: "김-보호자(가족)",
    });
  });

  it("rejects missing, overly long, and control-character depositor names", () => {
    expect(parseDepositorName("").ok).toBe(false);
    expect(parseDepositorName("가".repeat(MAX_DEPOSITOR_NAME_LENGTH + 1)).ok).toBe(false);
    expect(parseDepositorName("홍길동\n위조").ok).toBe(false);
    expect(parseDepositorName(`홍길동\u200B`).ok).toBe(false);
    expect(parseDepositorName(null).ok).toBe(false);
  });

  it("accepts only real calendar dates in YYYY-MM-DD form", () => {
    expect(parseExpectedDepositDate(" 2028-02-29 ")).toEqual({
      ok: true,
      value: "2028-02-29",
    });

    expect(parseExpectedDepositDate("2027-02-29").ok).toBe(false);
    expect(parseExpectedDepositDate("2026-04-31").ok).toBe(false);
    expect(parseExpectedDepositDate("2026-2-03").ok).toBe(false);
    expect(parseExpectedDepositDate("30-07-2026").ok).toBe(false);
    expect(parseExpectedDepositDate("").ok).toBe(false);
  });
});

describe("manual payment subscription period", () => {
  const approvedAt = new Date("2026-07-30T03:00:00.000Z");

  it("starts a new or expired subscription at the approval time", () => {
    const fresh = calculateManualPaymentPeriod({
      approvedAt,
      currentExpiresAt: null,
      durationDays: 90,
    });
    const expired = calculateManualPaymentPeriod({
      approvedAt,
      currentExpiresAt: new Date("2026-07-01T00:00:00.000Z"),
      durationDays: 90,
    });

    expect(fresh).toEqual({
      startsAt: approvedAt,
      expiresAt: new Date("2026-10-28T03:00:00.000Z"),
    });
    expect(expired).toEqual(fresh);
  });

  it("extends an active subscription from its current expiration", () => {
    const currentExpiresAt = new Date("2026-08-10T03:00:00.000Z");
    const period = calculateManualPaymentPeriod({
      approvedAt,
      currentExpiresAt,
      durationDays: 365,
    });

    expect(period).toEqual({
      startsAt: currentExpiresAt,
      expiresAt: new Date("2027-08-10T03:00:00.000Z"),
    });
    expect(period.startsAt).not.toBe(currentExpiresAt);
  });

  it("rejects invalid dates and non-positive or fractional durations", () => {
    expect(() =>
      calculateManualPaymentPeriod({
        approvedAt: new Date("invalid"),
        durationDays: 90,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateManualPaymentPeriod({
        approvedAt,
        durationDays: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateManualPaymentPeriod({
        approvedAt,
        durationDays: 1.5,
      }),
    ).toThrow(RangeError);
  });
});

describe("manual payment request number", () => {
  it("uses the Seoul calendar date and cryptographic entropy in a log-safe format", () => {
    const requestNumber = createManualPaymentRequestNumber(
      new Date("2026-07-29T15:30:00.000Z"),
      () => Uint8Array.from([0, 1, 2, 3, 10, 11, 254, 255]),
    );

    expect(requestNumber).toBe("PAY-20260730-000102030A0BFEFF");
    expect(requestNumber).toMatch(/^PAY-\d{8}-[0-9A-F]{16}$/u);
  });

  it("rejects invalid timestamps and malformed entropy providers", () => {
    expect(() => createManualPaymentRequestNumber(new Date("invalid"))).toThrow(RangeError);
    expect(() =>
      createManualPaymentRequestNumber(new Date(), () => Uint8Array.from([1, 2, 3])),
    ).toThrow("신청번호 난수는 8바이트여야 합니다.");
  });
});
