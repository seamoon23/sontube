"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-session";
import {
  PaymentServiceError,
  requestPaymentRefund,
} from "@/lib/payment-service";
import { ProcessLocalFixedWindowRateLimiter } from "@/lib/rate-limit";

export type PaymentActionResult = {
  ok: boolean;
  message: string;
};

const refundRequestRateLimiter = new ProcessLocalFixedWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 3,
  maxBuckets: 5_000,
});

export async function createPaymentRequestAction(): Promise<PaymentActionResult> {
  await requireAdminSession();
  return { ok: false, message: "현재 무료로 운영하며 신규 결제를 받지 않습니다." };
}

export async function requestPaymentRefundAction(
  paymentRequestId: string,
  formData: FormData,
): Promise<PaymentActionResult> {
  const session = await requireAdminSession();
  if (session.impersonatedBy) {
    return { ok: false, message: "대체 로그인 중에는 환불을 요청할 수 없습니다." };
  }
  if (!refundRequestRateLimiter.allow(session.familyId)) {
    return { ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." };
  }

  try {
    const result = await requestPaymentRefund({
      paymentRequestId,
      requestedById: session.userId,
      reason: formData.get("reason"),
    });
    revalidatePath("/admin/payment");
    return {
      ok: true,
      message: result.alreadyRequested
        ? "이미 접수된 환불 요청입니다."
        : "환불 요청을 접수했습니다. 실제 송금이 완료된 뒤 상태가 환불 완료로 바뀝니다.",
    };
  } catch (error) {
    return toActionError(error, "환불 요청을 접수하지 못했습니다.");
  }
}

function toActionError(error: unknown, fallback: string): PaymentActionResult {
  if (error instanceof PaymentServiceError) {
    return { ok: false, message: error.message };
  }
  console.error(fallback, error instanceof Error ? error.name : "UnknownError");
  return { ok: false, message: fallback };
}
