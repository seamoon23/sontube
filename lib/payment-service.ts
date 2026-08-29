import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  calculateManualPaymentPeriod,
  canTransitionManualPaymentStatus,
  createManualPaymentRequestNumber,
  parseDepositorName,
  parseExpectedDepositDate,
  parseKrwAmount,
  type ManualPaymentStatus,
} from "@/lib/manual-payment";

const MAX_USER_MEMO_LENGTH = 1_000;
const MAX_ADMIN_MEMO_LENGTH = 2_000;
const MAX_REFUND_REASON_LENGTH = 1_000;
const MAX_ACTOR_ID_LENGTH = 160;
const MAX_TRANSACTION_ATTEMPTS = 3;
const MAX_REQUEST_NUMBER_ATTEMPTS = 3;

export type PaymentServiceErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "INTEGRITY";

export class PaymentServiceError extends Error {
  constructor(
    public readonly code: PaymentServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentServiceError";
  }
}

export type CreatePaymentRequestInput = {
  familyId: string;
  requestedById: string;
  planId: string;
  depositorName: unknown;
  expectedDepositDate: unknown;
  userMemo?: unknown;
  now?: Date;
};

export type ConfirmPaymentRequestInput = {
  paymentRequestId: string;
  actorId: string;
  receivedAmountKrw: unknown;
  receivedDate: unknown;
  adminMemo?: unknown;
  now?: Date;
};

export type ResolvePendingPaymentInput = {
  paymentRequestId: string;
  actorId: string;
  adminMemo?: unknown;
  now?: Date;
};

export type RequestPaymentRefundInput = {
  paymentRequestId: string;
  requestedById: string;
  reason?: unknown;
  now?: Date;
};

export type ResolvePaymentRefundInput = {
  paymentRequestId: string;
  actorId: string;
  adminMemo?: unknown;
  now?: Date;
};

export type UpdatePaymentAdminMemoInput = {
  paymentRequestId: string;
  actorId: string;
  adminMemo?: unknown;
};

export async function createPaymentRequest(
  input: CreatePaymentRequestInput,
  database: PrismaClient = prisma,
) {
  const familyId = requireIdentifier(input.familyId, "가족");
  const requestedById = requireIdentifier(input.requestedById, "신청자");
  const planId = requireIdentifier(input.planId, "상품");
  const depositorName = unwrapValidation(parseDepositorName(input.depositorName));
  const expectedDepositDate = unwrapValidation(
    parseExpectedDepositDate(input.expectedDepositDate),
  );
  const userMemo = parseOptionalText(input.userMemo, MAX_USER_MEMO_LENGTH, "사용자 메모");
  const now = normalizeNow(input.now);
  const pendingKey = `${familyId}:${planId}`;

  for (let attempt = 0; attempt < MAX_REQUEST_NUMBER_ATTEMPTS; attempt += 1) {
    try {
      return await runTransactionWithRetry(database, async (tx) => {
        const requester = await tx.parentUser.findFirst({
          where: {
            id: requestedById,
            familyId,
            isActive: true,
            family: { isActive: true },
          },
          select: { id: true },
        });

        if (!requester) {
          throw new PaymentServiceError(
            "FORBIDDEN",
            "활성화된 가족의 부모 계정만 결제를 신청할 수 있습니다.",
          );
        }

        const existing = await tx.paymentRequest.findUnique({
          where: { pendingKey },
        });

        if (existing) {
          if (existing.status !== "PENDING") {
            throw new PaymentServiceError(
              "INTEGRITY",
              "처리 완료 결제에 대기 중 중복키가 남아 있습니다.",
            );
          }

          return { created: false as const, paymentRequest: existing };
        }

        const plan = await tx.paymentPlan.findUnique({
          where: { id: planId },
        });

        if (!plan || !plan.isActive) {
          throw new PaymentServiceError("NOT_FOUND", "현재 신청할 수 있는 이용권 상품이 아닙니다.");
        }

        const amountKrw = unwrapValidation(parseKrwAmount(plan.priceKrw));
        if (!Number.isSafeInteger(plan.durationDays) || plan.durationDays <= 0) {
          throw new PaymentServiceError("INTEGRITY", "상품 이용기간 설정이 올바르지 않습니다.");
        }

        const paymentRequest = await tx.paymentRequest.create({
          data: {
            requestNo: createManualPaymentRequestNumber(now),
            familyId,
            requestedById,
            planId: plan.id,
            planCodeSnapshot: plan.code,
            planNameSnapshot: plan.name,
            amountKrw,
            durationDaysSnapshot: plan.durationDays,
            depositorName,
            expectedDepositDate,
            requestedAt: now,
            pendingKey,
            userMemo,
          },
        });

        await tx.paymentAuditLog.create({
          data: {
            paymentRequestId: paymentRequest.id,
            actorType: "PARENT",
            actorId: requestedById,
            action: "PAYMENT_REQUESTED",
            nextStatus: "PENDING",
          },
        });

        return { created: true as const, paymentRequest };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await database.paymentRequest.findUnique({
        where: { pendingKey },
      });

      if (existing) {
        if (existing.status !== "PENDING") {
          throw new PaymentServiceError(
            "INTEGRITY",
            "처리 완료 결제에 대기 중 중복키가 남아 있습니다.",
          );
        }

        return { created: false as const, paymentRequest: existing };
      }
    }
  }

  throw new PaymentServiceError(
    "CONFLICT",
    "결제 신청번호를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
  );
}

export async function confirmPaymentRequest(
  input: ConfirmPaymentRequestInput,
  database: PrismaClient = prisma,
) {
  const paymentRequestId = requireIdentifier(input.paymentRequestId, "결제 신청");
  const actorId = requireActorId(input.actorId);
  const receivedAmountKrw = unwrapValidation(parseKrwAmount(input.receivedAmountKrw));
  const receivedDate = unwrapValidation(parseExpectedDepositDate(input.receivedDate));
  const adminMemo = parseOptionalText(input.adminMemo, MAX_ADMIN_MEMO_LENGTH, "관리자 메모");
  const now = normalizeNow(input.now);

  return runTransactionWithRetry(database, async (tx) => {
    const claimed = await tx.paymentRequest.updateMany({
      where: {
        id: paymentRequestId,
        status: "PENDING",
        amountKrw: receivedAmountKrw,
      },
      data: {
        status: "CONFIRMED",
        pendingKey: null,
        confirmedAt: now,
        confirmedBy: actorId,
        receivedAmountKrw,
        receivedDate,
        ...(adminMemo !== undefined ? { adminMemo } : {}),
      },
    });

    if (claimed.count === 0) {
      const current = await tx.paymentRequest.findUnique({
        where: { id: paymentRequestId },
        include: { grant: true },
      });

      if (!current) {
        throw new PaymentServiceError("NOT_FOUND", "결제 신청을 찾을 수 없습니다.");
      }

      if (current.status === "CONFIRMED") {
        if (!current.grant) {
          throw new PaymentServiceError(
            "INTEGRITY",
            "승인된 결제와 연결된 이용권 지급 기록이 없습니다.",
          );
        }

        const subscription = await tx.familySubscription.findUnique({
          where: { familyId: current.familyId },
        });
        if (!subscription) {
          throw new PaymentServiceError(
            "INTEGRITY",
            "승인된 결제와 연결된 가족 이용권이 없습니다.",
          );
        }

        return {
          alreadyConfirmed: true as const,
          paymentRequest: current,
          subscription,
          grant: current.grant,
        };
      }

      if (current.status === "PENDING") {
        throw new PaymentServiceError(
          "VALIDATION",
          "실제 입금액이 결제 신청금액과 일치하지 않습니다.",
        );
      }

      throw invalidTransition(current.status, "CONFIRMED");
    }

    const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentRequestId },
    });
    const currentSubscription = await tx.familySubscription.findUnique({
      where: { familyId: paymentRequest.familyId },
    });
    const extendsActiveSubscription = Boolean(
      currentSubscription &&
        currentSubscription.status === "ACTIVE" &&
        currentSubscription.expiresAt.getTime() > now.getTime(),
    );
    const period = calculateManualPaymentPeriod({
      approvedAt: now,
      currentExpiresAt: extendsActiveSubscription ? currentSubscription?.expiresAt : null,
      durationDays: paymentRequest.durationDaysSnapshot,
    });

    const subscription = currentSubscription
      ? await tx.familySubscription.update({
          where: { id: currentSubscription.id },
          data: {
            startsAt: extendsActiveSubscription ? currentSubscription.startsAt : period.startsAt,
            expiresAt: period.expiresAt,
            status: "ACTIVE",
            version: { increment: 1 },
          },
        })
      : await tx.familySubscription.create({
          data: {
            familyId: paymentRequest.familyId,
            startsAt: period.startsAt,
            expiresAt: period.expiresAt,
            status: "ACTIVE",
          },
        });

    const grant = await tx.subscriptionGrant.create({
      data: {
        familyId: paymentRequest.familyId,
        subscriptionId: subscription.id,
        paymentRequestId: paymentRequest.id,
        startsAt: period.startsAt,
        expiresAt: period.expiresAt,
        durationDays: paymentRequest.durationDaysSnapshot,
      },
    });

    await tx.appAccessKey.updateMany({
      where: { familyId: paymentRequest.familyId },
      data: { paidUntil: period.expiresAt },
    });

    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "SUPERADMIN",
        actorId: actorId,
        action: "PAYMENT_CONFIRMED",
        previousStatus: "PENDING",
        nextStatus: "CONFIRMED",
      },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "SUPERADMIN",
        actorId: actorId,
        action: currentSubscription ? "SUBSCRIPTION_EXTENDED" : "SUBSCRIPTION_CREATED",
        previousStatus: "CONFIRMED",
        nextStatus: "CONFIRMED",
      },
    });

    return {
      alreadyConfirmed: false as const,
      paymentRequest,
      subscription,
      grant,
    };
  });
}

export async function rejectPaymentRequest(
  input: ResolvePendingPaymentInput,
  database: PrismaClient = prisma,
) {
  return resolvePendingPayment(
    input,
    {
      targetStatus: "REJECTED",
      action: "PAYMENT_REJECTED",
      dateField: "rejectedAt",
      actorField: "rejectedBy",
    },
    database,
  );
}

export async function expirePaymentRequest(
  input: ResolvePendingPaymentInput,
  database: PrismaClient = prisma,
) {
  return resolvePendingPayment(
    input,
    {
      targetStatus: "EXPIRED",
      action: "PAYMENT_EXPIRED",
      dateField: "expiredAt",
    },
    database,
  );
}

export async function requestPaymentRefund(
  input: RequestPaymentRefundInput,
  database: PrismaClient = prisma,
) {
  const paymentRequestId = requireIdentifier(input.paymentRequestId, "결제 신청");
  const requestedById = requireIdentifier(input.requestedById, "신청자");
  const reason = parseOptionalText(input.reason, MAX_REFUND_REASON_LENGTH, "환불 사유");
  const now = normalizeNow(input.now);

  return runTransactionWithRetry(database, async (tx) => {
    const requester = await tx.parentUser.findFirst({
      where: {
        id: requestedById,
        isActive: true,
        family: { isActive: true },
      },
      select: { id: true, familyId: true },
    });
    if (!requester) {
      throw new PaymentServiceError("FORBIDDEN", "활성화된 부모 계정만 환불을 요청할 수 있습니다.");
    }

    const claimed = await tx.paymentRequest.updateMany({
      where: {
        id: paymentRequestId,
        familyId: requester.familyId,
        status: "CONFIRMED",
        refundAmountKrw: 0,
      },
      data: {
        status: "REFUND_REQUESTED",
        refundRequestedAt: now,
      },
    });

    if (claimed.count === 0) {
      const current = await tx.paymentRequest.findUnique({
        where: { id: paymentRequestId },
      });
      if (!current) {
        throw new PaymentServiceError("NOT_FOUND", "결제 신청을 찾을 수 없습니다.");
      }
      if (current.familyId !== requester.familyId) {
        throw new PaymentServiceError("FORBIDDEN", "다른 가족의 결제는 환불 요청할 수 없습니다.");
      }
      if (current.status === "REFUND_REQUESTED") {
        const existingRefund = await tx.paymentRefund.findFirst({
          where: { paymentRequestId, status: "REQUESTED" },
          orderBy: { requestedAt: "desc" },
        });
        if (!existingRefund) {
          throw new PaymentServiceError(
            "INTEGRITY",
            "환불 요청 상태와 연결된 환불 기록이 없습니다.",
          );
        }
        return {
          alreadyRequested: true as const,
          paymentRequest: current,
          refund: existingRefund,
        };
      }
      throw invalidTransition(current.status, "REFUND_REQUESTED");
    }

    const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentRequestId },
    });
    const refund = await tx.paymentRefund.create({
      data: {
        paymentRequestId,
        requestedById,
        amountKrw: paymentRequest.amountKrw,
        reason,
        requestedAt: now,
      },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "PARENT",
        actorId: requestedById,
        action: "REFUND_REQUESTED",
        previousStatus: "CONFIRMED",
        nextStatus: "REFUND_REQUESTED",
      },
    });

    return {
      alreadyRequested: false as const,
      paymentRequest,
      refund,
    };
  });
}

export async function rejectPaymentRefund(
  input: ResolvePaymentRefundInput,
  database: PrismaClient = prisma,
) {
  const paymentRequestId = requireIdentifier(input.paymentRequestId, "결제 신청");
  const actorId = requireActorId(input.actorId);
  const adminMemo = parseOptionalText(input.adminMemo, MAX_ADMIN_MEMO_LENGTH, "관리자 메모");
  const now = normalizeNow(input.now);

  return runTransactionWithRetry(database, async (tx) => {
    const claimed = await tx.paymentRequest.updateMany({
      where: { id: paymentRequestId, status: "REFUND_REQUESTED" },
      data: {
        status: "CONFIRMED",
        ...(adminMemo !== undefined ? { adminMemo } : {}),
      },
    });

    if (claimed.count === 0) {
      const current = await tx.paymentRequest.findUnique({
        where: { id: paymentRequestId },
      });
      if (!current) {
        throw new PaymentServiceError("NOT_FOUND", "결제 신청을 찾을 수 없습니다.");
      }
      if (current.status === "CONFIRMED") {
        const rejectedRefund = await tx.paymentRefund.findFirst({
          where: { paymentRequestId, status: "REJECTED" },
          orderBy: { processedAt: "desc" },
        });
        if (rejectedRefund) {
          return {
            alreadyRejected: true as const,
            paymentRequest: current,
            refund: rejectedRefund,
          };
        }
      }
      throw invalidTransition(current.status, "CONFIRMED");
    }

    const refund = await tx.paymentRefund.findFirst({
      where: { paymentRequestId, status: "REQUESTED" },
      orderBy: { requestedAt: "desc" },
    });
    if (!refund) {
      throw new PaymentServiceError("INTEGRITY", "처리할 환불 요청 기록이 없습니다.");
    }

    const processedRefund = await tx.paymentRefund.update({
      where: { id: refund.id },
      data: {
        status: "REJECTED",
        processedAt: now,
        processedBy: actorId,
        ...(adminMemo !== undefined ? { adminMemo } : {}),
      },
    });
    const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentRequestId },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "SUPERADMIN",
        actorId: actorId,
        action: "REFUND_REJECTED",
        previousStatus: "REFUND_REQUESTED",
        nextStatus: "CONFIRMED",
      },
    });

    return {
      alreadyRejected: false as const,
      paymentRequest,
      refund: processedRefund,
    };
  });
}

export async function completePaymentRefund(
  input: ResolvePaymentRefundInput,
  database: PrismaClient = prisma,
) {
  const paymentRequestId = requireIdentifier(input.paymentRequestId, "결제 신청");
  const actorId = requireActorId(input.actorId);
  const adminMemo = parseOptionalText(input.adminMemo, MAX_ADMIN_MEMO_LENGTH, "관리자 메모");
  const now = normalizeNow(input.now);

  return runTransactionWithRetry(database, async (tx) => {
    const claimed = await tx.paymentRequest.updateMany({
      where: {
        id: paymentRequestId,
        status: "REFUND_REQUESTED",
        refundAmountKrw: 0,
      },
      data: {
        status: "REFUNDED",
        refundedAt: now,
        refundedBy: actorId,
        ...(adminMemo !== undefined ? { adminMemo } : {}),
      },
    });

    if (claimed.count === 0) {
      const current = await tx.paymentRequest.findUnique({
        where: { id: paymentRequestId },
        include: { grant: true },
      });
      if (!current) {
        throw new PaymentServiceError("NOT_FOUND", "결제 신청을 찾을 수 없습니다.");
      }
      if (current.status === "REFUNDED") {
        const completedRefund = await tx.paymentRefund.findFirst({
          where: { paymentRequestId, status: "COMPLETED" },
          orderBy: { processedAt: "desc" },
        });
        const subscription = await tx.familySubscription.findUnique({
          where: { familyId: current.familyId },
        });
        if (!completedRefund || !current.grant || current.grant.status !== "CANCELLED" || !subscription) {
          throw new PaymentServiceError(
            "INTEGRITY",
            "환불 완료 결제의 이용권 또는 환불 기록이 올바르지 않습니다.",
          );
        }
        return {
          alreadyCompleted: true as const,
          paymentRequest: current,
          refund: completedRefund,
          subscription,
          grant: current.grant,
        };
      }
      throw invalidTransition(current.status, "REFUNDED");
    }

    const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentRequestId },
      include: { grant: true },
    });
    if (!paymentRequest.grant || paymentRequest.grant.status !== "ACTIVE") {
      throw new PaymentServiceError("INTEGRITY", "취소할 활성 이용권 지급 기록이 없습니다.");
    }

    const latestActiveGrant = await tx.subscriptionGrant.findFirst({
      where: {
        familyId: paymentRequest.familyId,
        status: "ACTIVE",
      },
      orderBy: [{ expiresAt: "desc" }, { createdAt: "desc" }],
    });
    if (!latestActiveGrant || latestActiveGrant.id !== paymentRequest.grant.id) {
      throw new PaymentServiceError(
        "CONFLICT",
        "이 결제 이후에 연장된 이용권이 있어 먼저 환불할 수 없습니다.",
      );
    }

    const requestedRefund = await tx.paymentRefund.findFirst({
      where: { paymentRequestId, status: "REQUESTED" },
      orderBy: { requestedAt: "desc" },
    });
    if (!requestedRefund || requestedRefund.amountKrw !== paymentRequest.amountKrw) {
      throw new PaymentServiceError(
        "INTEGRITY",
        "전액 환불 요청 금액이 원 결제금액과 일치하지 않습니다.",
      );
    }

    const subscription = await tx.familySubscription.findUnique({
      where: { familyId: paymentRequest.familyId },
    });
    if (!subscription || subscription.id !== paymentRequest.grant.subscriptionId) {
      throw new PaymentServiceError("INTEGRITY", "가족 이용권 연결 정보가 올바르지 않습니다.");
    }

    const cancelledGrant = await tx.subscriptionGrant.update({
      where: { id: paymentRequest.grant.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
      },
    });
    const previousActiveGrant = await tx.subscriptionGrant.findFirst({
      where: {
        familyId: paymentRequest.familyId,
        status: "ACTIVE",
      },
      orderBy: [{ expiresAt: "desc" }, { createdAt: "desc" }],
    });
    const restoredExpiresAt = previousActiveGrant?.expiresAt ?? paymentRequest.grant.startsAt;
    const restoredSubscription = await tx.familySubscription.update({
      where: { id: subscription.id },
      data: {
        startsAt: previousActiveGrant ? subscription.startsAt : paymentRequest.grant.startsAt,
        expiresAt: restoredExpiresAt,
        status: previousActiveGrant
          ? subscription.status === "SUSPENDED"
            ? "SUSPENDED"
            : "ACTIVE"
          : "CANCELLED",
        version: { increment: 1 },
      },
    });
    const completedRefund = await tx.paymentRefund.update({
      where: { id: requestedRefund.id },
      data: {
        status: "COMPLETED",
        amountKrw: paymentRequest.amountKrw,
        processedAt: now,
        processedBy: actorId,
        ...(adminMemo !== undefined ? { adminMemo } : {}),
      },
    });
    const updatedPaymentRequest = await tx.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { refundAmountKrw: paymentRequest.amountKrw },
    });

    await tx.appAccessKey.updateMany({
      where: { familyId: paymentRequest.familyId },
      data: { paidUntil: previousActiveGrant?.expiresAt ?? null },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "SUPERADMIN",
        actorId: actorId,
        action: "REFUND_COMPLETED",
        previousStatus: "REFUND_REQUESTED",
        nextStatus: "REFUNDED",
      },
    });

    return {
      alreadyCompleted: false as const,
      paymentRequest: updatedPaymentRequest,
      refund: completedRefund,
      subscription: restoredSubscription,
      grant: cancelledGrant,
    };
  });
}

export async function updatePaymentAdminMemo(
  input: UpdatePaymentAdminMemoInput,
  database: PrismaClient = prisma,
) {
  const paymentRequestId = requireIdentifier(input.paymentRequestId, "결제 신청");
  const actorId = requireActorId(input.actorId);
  const adminMemo = parseOptionalText(input.adminMemo, MAX_ADMIN_MEMO_LENGTH, "관리자 메모") ?? null;

  return runTransactionWithRetry(database, async (tx) => {
    const current = await tx.paymentRequest.findUnique({
      where: { id: paymentRequestId },
    });
    if (!current) {
      throw new PaymentServiceError("NOT_FOUND", "결제 신청을 찾을 수 없습니다.");
    }
    if ((current.adminMemo ?? null) === adminMemo) {
      return { changed: false as const, paymentRequest: current };
    }

    const paymentRequest = await tx.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { adminMemo },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "SUPERADMIN",
        actorId: actorId,
        action: "ADMIN_MEMO_UPDATED",
        previousStatus: current.status,
        nextStatus: current.status,
        memo: adminMemo ? "관리자 메모를 수정했습니다." : "관리자 메모를 비웠습니다.",
      },
    });

    return { changed: true as const, paymentRequest };
  });
}

type PendingResolutionConfig = {
  targetStatus: "REJECTED" | "EXPIRED";
  action: "PAYMENT_REJECTED" | "PAYMENT_EXPIRED";
  dateField: "rejectedAt" | "expiredAt";
  actorField?: "rejectedBy";
};

async function resolvePendingPayment(
  input: ResolvePendingPaymentInput,
  config: PendingResolutionConfig,
  database: PrismaClient,
) {
  const paymentRequestId = requireIdentifier(input.paymentRequestId, "결제 신청");
  const actorId = requireActorId(input.actorId);
  const adminMemo = parseOptionalText(input.adminMemo, MAX_ADMIN_MEMO_LENGTH, "관리자 메모");
  const now = normalizeNow(input.now);

  return runTransactionWithRetry(database, async (tx) => {
    const data: Prisma.PaymentRequestUpdateManyMutationInput = {
      status: config.targetStatus,
      pendingKey: null,
      [config.dateField]: now,
      ...(config.actorField ? { [config.actorField]: actorId } : {}),
      ...(adminMemo !== undefined ? { adminMemo } : {}),
    };
    const claimed = await tx.paymentRequest.updateMany({
      where: { id: paymentRequestId, status: "PENDING" },
      data,
    });

    const paymentRequest = await tx.paymentRequest.findUnique({
      where: { id: paymentRequestId },
    });
    if (!paymentRequest) {
      throw new PaymentServiceError("NOT_FOUND", "결제 신청을 찾을 수 없습니다.");
    }
    if (claimed.count === 0) {
      if (paymentRequest.status === config.targetStatus) {
        return { alreadyProcessed: true as const, paymentRequest };
      }
      throw invalidTransition(paymentRequest.status, config.targetStatus);
    }

    await tx.paymentAuditLog.create({
      data: {
        paymentRequestId,
        actorType: "SUPERADMIN",
        actorId: actorId,
        action: config.action,
        previousStatus: "PENDING",
        nextStatus: config.targetStatus,
      },
    });

    return { alreadyProcessed: false as const, paymentRequest };
  });
}

async function runTransactionWithRetry<T>(
  database: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(operation, {
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS - 1) {
        throw error;
      }

      lastError = error;
      await delay(15 * 2 ** attempt);
    }
  }

  throw lastError;
}

function invalidTransition(from: string, to: ManualPaymentStatus): PaymentServiceError {
  if (isManualPaymentStatus(from) && canTransitionManualPaymentStatus(from, to)) {
    return new PaymentServiceError(
      "CONFLICT",
      "결제 상태가 다른 요청에서 먼저 변경되었습니다. 화면을 새로고침해 주세요.",
    );
  }

  return new PaymentServiceError(
    "CONFLICT",
    `${from} 상태의 결제를 ${to} 상태로 변경할 수 없습니다.`,
  );
}

function isManualPaymentStatus(value: string): value is ManualPaymentStatus {
  return [
    "PENDING",
    "CONFIRMED",
    "REJECTED",
    "EXPIRED",
    "REFUND_REQUESTED",
    "REFUNDED",
    "PARTIAL_REFUNDED",
  ].includes(value);
}

function unwrapValidation<T>(
  result: { ok: true; value: T } | { ok: false; message: string },
): T {
  if (!result.ok) {
    throw new PaymentServiceError("VALIDATION", result.message);
  }
  return result.value;
}

function requireIdentifier(value: string, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new PaymentServiceError("VALIDATION", `${label} 식별자가 올바르지 않습니다.`);
  }
  return normalized;
}

function requireActorId(value: string): string {
  const normalized = requireIdentifier(value, "최종관리자");
  if (normalized.length > MAX_ACTOR_ID_LENGTH) {
    throw new PaymentServiceError("VALIDATION", "최종관리자 식별자가 너무 깁니다.");
  }
  return normalized;
}

function parseOptionalText(
  value: unknown,
  maxLength: number,
  label: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new PaymentServiceError("VALIDATION", `${label} 형식이 올바르지 않습니다.`);
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200d\ufeff]/u.test(normalized)) {
    throw new PaymentServiceError("VALIDATION", `${label}에 사용할 수 없는 문자가 포함되어 있습니다.`);
  }
  if (Array.from(normalized).length > maxLength) {
    throw new PaymentServiceError("VALIDATION", `${label}는 ${maxLength}자 이하로 입력해 주세요.`);
  }

  return normalized || null;
}

function normalizeNow(value: Date | undefined): Date {
  const now = value ? new Date(value) : new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new PaymentServiceError("VALIDATION", "처리 시각이 올바르지 않습니다.");
  }
  return now;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1008" || error.code === "P2034";
  }

  return error instanceof Error && /database is locked|SQLITE_BUSY/iu.test(error.message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
