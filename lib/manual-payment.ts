import { randomBytes } from "node:crypto";

export const MANUAL_PAYMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED",
  "REFUND_REQUESTED",
  "REFUNDED",
  "PARTIAL_REFUNDED",
] as const;

export type ManualPaymentStatus = (typeof MANUAL_PAYMENT_STATUSES)[number];

export type ManualPaymentValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      message: string;
    };

export const MAX_MANUAL_PAYMENT_KRW = 100_000_000;
export const MAX_DEPOSITOR_NAME_LENGTH = 40;

const STATUS_LABELS: Record<ManualPaymentStatus, string> = {
  PENDING: "입금 확인 대기",
  CONFIRMED: "입금 확인 완료",
  REJECTED: "확인 불가",
  EXPIRED: "신청 만료",
  REFUND_REQUESTED: "환불 요청 접수",
  REFUNDED: "환불 완료",
  PARTIAL_REFUNDED: "일부 환불 완료",
};

const ALLOWED_STATUS_TRANSITIONS: Record<ManualPaymentStatus, readonly ManualPaymentStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "EXPIRED"],
  CONFIRMED: ["REFUND_REQUESTED"],
  REJECTED: [],
  EXPIRED: [],
  REFUND_REQUESTED: ["CONFIRMED", "REFUNDED"],
  REFUNDED: [],
  // 부분 환불은 표시 호환성을 위해 상태만 유지하고 이번 수동 처리 흐름에서는 만들지 않는다.
  PARTIAL_REFUNDED: [],
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const INVALID_NAME_CHARACTERS = /[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/u;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const REQUEST_RANDOM_BYTE_LENGTH = 8;

type RandomBytesProvider = (size: number) => Uint8Array;

export function getManualPaymentStatusLabel(status: ManualPaymentStatus): string {
  return STATUS_LABELS[status];
}

export function canTransitionManualPaymentStatus(
  from: ManualPaymentStatus,
  to: ManualPaymentStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function parseKrwAmount(value: unknown): ManualPaymentValidationResult<number> {
  const parsed = parseStrictInteger(value);

  if (
    parsed === null ||
    parsed < 1 ||
    parsed > MAX_MANUAL_PAYMENT_KRW ||
    !Number.isSafeInteger(parsed)
  ) {
    return {
      ok: false,
      message: `결제금액은 1원 이상 ${MAX_MANUAL_PAYMENT_KRW.toLocaleString("ko-KR")}원 이하의 정수로 입력해 주세요.`,
    };
  }

  return { ok: true, value: parsed };
}

export function parseDepositorName(value: unknown): ManualPaymentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, message: "입금자명을 입력해 주세요." };
  }

  const compatibilityNormalized = value.normalize("NFKC");

  if (INVALID_NAME_CHARACTERS.test(compatibilityNormalized)) {
    return { ok: false, message: "입금자명에 사용할 수 없는 문자가 포함되어 있습니다." };
  }

  const normalized = compatibilityNormalized.trim().replace(/\s+/gu, " ");
  const length = Array.from(normalized).length;

  if (length === 0) {
    return { ok: false, message: "입금자명을 입력해 주세요." };
  }

  if (length > MAX_DEPOSITOR_NAME_LENGTH) {
    return {
      ok: false,
      message: `입금자명은 ${MAX_DEPOSITOR_NAME_LENGTH}자 이하로 입력해 주세요.`,
    };
  }

  return { ok: true, value: normalized };
}

export function parseExpectedDepositDate(value: unknown): ManualPaymentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, message: "입금일을 YYYY-MM-DD 형식으로 입력해 주세요." };
  }

  const normalized = value.trim();
  const match = ISO_DATE_PATTERN.exec(normalized);

  if (!match) {
    return { ok: false, message: "입금일을 YYYY-MM-DD 형식으로 입력해 주세요." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, message: "실제로 존재하는 입금일을 입력해 주세요." };
  }

  return { ok: true, value: normalized };
}

export function calculateManualPaymentPeriod(input: {
  approvedAt: Date;
  currentExpiresAt?: Date | null;
  durationDays: number;
}): {
  startsAt: Date;
  expiresAt: Date;
} {
  assertValidDate(input.approvedAt, "승인 시각");

  if (input.currentExpiresAt) {
    assertValidDate(input.currentExpiresAt, "현재 이용권 만료 시각");
  }

  if (!Number.isSafeInteger(input.durationDays) || input.durationDays <= 0) {
    throw new RangeError("이용기간은 1일 이상의 정수여야 합니다.");
  }

  const startsAt =
    input.currentExpiresAt && input.currentExpiresAt.getTime() > input.approvedAt.getTime()
      ? new Date(input.currentExpiresAt)
      : new Date(input.approvedAt);
  const expiresAt = new Date(startsAt.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

  assertValidDate(expiresAt, "계산된 이용권 만료 시각");

  return { startsAt, expiresAt };
}

export function createManualPaymentRequestNumber(
  now = new Date(),
  randomBytesProvider: RandomBytesProvider = randomBytes,
): string {
  assertValidDate(now, "신청 시각");

  const seoulTime = new Date(now.getTime() + SEOUL_OFFSET_MS);
  const datePart = [
    seoulTime.getUTCFullYear().toString().padStart(4, "0"),
    (seoulTime.getUTCMonth() + 1).toString().padStart(2, "0"),
    seoulTime.getUTCDate().toString().padStart(2, "0"),
  ].join("");
  const entropy = randomBytesProvider(REQUEST_RANDOM_BYTE_LENGTH);

  if (entropy.length !== REQUEST_RANDOM_BYTE_LENGTH) {
    throw new Error(`신청번호 난수는 ${REQUEST_RANDOM_BYTE_LENGTH}바이트여야 합니다.`);
  }

  const randomPart = Array.from(entropy, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return `PAY-${datePart}-${randomPart}`;
}

function parseStrictInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError(`${label}이 올바르지 않습니다.`);
  }
}
