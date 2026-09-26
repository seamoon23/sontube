const UTF8_BOM = "\uFEFF";

const HEADERS = [
  "신청번호",
  "상태",
  "가족",
  "신청자",
  "신청자 이메일",
  "상품 코드",
  "상품명",
  "이용일수",
  "신청금액",
  "입금자명",
  "입금예정일",
  "신청시각(UTC)",
  "실제입금액",
  "실제입금일",
  "입금확인시각(UTC)",
  "환불금액",
  "환불요청시각(UTC)",
  "환불완료시각(UTC)",
  "처리담당",
] as const;

export type PaymentReconciliationRow = {
  requestNo: string;
  status: string;
  planCodeSnapshot: string;
  planNameSnapshot: string;
  amountKrw: number;
  durationDaysSnapshot: number;
  depositorName: string;
  expectedDepositDate: string | null;
  requestedAt: Date;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  receivedAmountKrw: number | null;
  receivedDate: string | null;
  rejectedBy: string | null;
  refundRequestedAt: Date | null;
  refundedAt: Date | null;
  refundedBy: string | null;
  refundAmountKrw: number;
  family: { name: string };
  requestedBy: { displayName: string; email: string };
};

export function createPaymentReconciliationCsv(rows: PaymentReconciliationRow[]): string {
  const lines = [
    HEADERS.map(toCsvCell).join(","),
    ...rows.map((row) =>
      [
        row.requestNo,
        row.status,
        row.family.name,
        row.requestedBy.displayName,
        row.requestedBy.email,
        row.planCodeSnapshot,
        row.planNameSnapshot,
        row.durationDaysSnapshot,
        row.amountKrw,
        row.depositorName,
        row.expectedDepositDate,
        row.requestedAt,
        row.receivedAmountKrw,
        row.receivedDate,
        row.confirmedAt,
        row.refundAmountKrw,
        row.refundRequestedAt,
        row.refundedAt,
        row.refundedBy ?? row.confirmedBy ?? row.rejectedBy,
      ]
        .map(toCsvCell)
        .join(","),
    ),
  ];

  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}

function toCsvCell(value: string | number | Date | null): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");

  // Spreadsheet programs can execute cells beginning with these characters.
  if (/^\s*[=+\-@]/u.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
