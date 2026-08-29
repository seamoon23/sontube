export type ManualPaymentConfig = {
  businessName: string;
  businessNumber: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  confirmationNotice: string;
  supportContact: string;
  refundPolicy: string;
  isConfigured: boolean;
};

type PaymentEnv = Record<string, string | undefined>;

export function getManualPaymentConfig(env: PaymentEnv = process.env): ManualPaymentConfig {
  const businessName = clean(env.PAYMENT_BUSINESS_NAME);
  const businessNumber = clean(env.PAYMENT_BUSINESS_NUMBER);
  const bankName = clean(env.PAYMENT_BANK_NAME);
  const accountNumber = clean(env.PAYMENT_ACCOUNT_NUMBER);
  const accountHolder = clean(env.PAYMENT_ACCOUNT_HOLDER);
  const confirmationNotice =
    clean(env.PAYMENT_CONFIRMATION_NOTICE) ||
    "입금 확인은 영업일 기준 1일 안에 처리됩니다. 확인이 늦어지면 신청번호와 함께 문의해 주세요.";
  const supportContact = clean(env.PAYMENT_SUPPORT_CONTACT);
  const refundPolicy =
    clean(env.PAYMENT_REFUND_POLICY) ||
    "환불이 필요하면 결제 내역에서 요청해 주세요. 현재는 전액 환불만 접수하며, 처리 전 안내를 드립니다.";

  return {
    businessName,
    businessNumber,
    bankName,
    accountNumber,
    accountHolder,
    confirmationNotice,
    supportContact,
    refundPolicy,
    isConfigured: Boolean(
      businessName &&
        businessNumber &&
        bankName &&
        accountNumber &&
        accountHolder &&
        supportContact,
    ),
  };
}

function clean(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}