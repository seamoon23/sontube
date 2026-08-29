import { describe, expect, it } from "vitest";
import { getManualPaymentConfig } from "@/lib/payment-config";

describe("manual payment config", () => {
  it("requires all business, bank, and support fields before accepting applications", () => {
    expect(getManualPaymentConfig({}).isConfigured).toBe(false);
    expect(
      getManualPaymentConfig({
        PAYMENT_BUSINESS_NAME: "SonTube",
        PAYMENT_BUSINESS_NUMBER: "123-45-67890",
        PAYMENT_BANK_NAME: "테스트은행",
        PAYMENT_ACCOUNT_NUMBER: "000-000-000000",
        PAYMENT_ACCOUNT_HOLDER: "SonTube",
        PAYMENT_SUPPORT_CONTACT: "support@example.test",
      }).isConfigured,
    ).toBe(true);
  });

  it("normalizes whitespace and supplies safe operational defaults", () => {
    const config = getManualPaymentConfig({
      PAYMENT_BUSINESS_NAME: "  SonTube   스튜디오 ",
    });

    expect(config.businessName).toBe("SonTube 스튜디오");
    expect(config.confirmationNotice).toContain("영업일");
    expect(config.refundPolicy).toContain("전액 환불");
  });
});