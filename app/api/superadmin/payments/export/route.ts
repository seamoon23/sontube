import { prisma } from "@/lib/db";
import { createPaymentReconciliationCsv } from "@/lib/payment-reconciliation-csv";
import { requireSuperAdminSession } from "@/lib/superadmin-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  await requireSuperAdminSession();

  const payments = await prisma.paymentRequest.findMany({
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    select: {
      requestNo: true,
      status: true,
      planCodeSnapshot: true,
      planNameSnapshot: true,
      amountKrw: true,
      durationDaysSnapshot: true,
      depositorName: true,
      expectedDepositDate: true,
      requestedAt: true,
      confirmedAt: true,
      confirmedBy: true,
      receivedAmountKrw: true,
      receivedDate: true,
      rejectedBy: true,
      refundRequestedAt: true,
      refundedAt: true,
      refundedBy: true,
      refundAmountKrw: true,
      family: { select: { name: true } },
      requestedBy: { select: { displayName: true, email: true } },
    },
  });

  return new Response(createPaymentReconciliationCsv(payments), {
    headers: {
      "cache-control": "private, no-store, max-age=0, must-revalidate",
      "content-disposition": `attachment; filename="sontube-payments-${new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())}.csv"`,
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
