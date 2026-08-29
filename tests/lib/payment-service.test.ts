import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completePaymentRefund,
  confirmPaymentRequest,
  createPaymentRequest,
  expirePaymentRequest,
  rejectPaymentRefund,
  rejectPaymentRequest,
  requestPaymentRefund,
  updatePaymentAdminMemo,
} from "@/lib/payment-service";

const databaseFileName = `.payment-service-${process.pid}-${Date.now()}.db`;
const databasePath = join(process.cwd(), "prisma", databaseFileName);
const databaseUrl = `file:${databasePath.replace(/\\/gu, "/")}`;
const databaseArtifacts = [
  databasePath,
  `${databasePath}-journal`,
  `${databasePath}-shm`,
  `${databasePath}-wal`,
];

let database: PrismaClient;

beforeAll(async () => {
  cleanupDatabaseArtifacts();
  database = new PrismaClient({ datasourceUrl: databaseUrl });
  await createTestSchema(database);
}, 30_000);

afterAll(async () => {
  await database?.$disconnect();
  cleanupDatabaseArtifacts();
});

describe("payment request service", () => {
  it("snapshots the server plan and returns the existing pending request on duplicate submission", async () => {
    const fixture = await createFixture("snapshot");
    const input = {
      familyId: fixture.family.id,
      requestedById: fixture.parent.id,
      planId: fixture.plan.id,
      depositorName: "  엄   동건 ",
      expectedDepositDate: "2026-07-30",
      userMemo: "베타 신청",
      now: new Date("2026-07-30T00:00:00.000Z"),
    };

    const first = await createPaymentRequest(input, database);
    await database.paymentPlan.update({
      where: { id: fixture.plan.id },
      data: { priceKrw: 55_000, durationDays: 365, isActive: false },
    });
    const duplicate = await createPaymentRequest(input, database);

    expect(first.created).toBe(true);
    expect(first.paymentRequest).toMatchObject({
      amountKrw: 39_000,
      durationDaysSnapshot: 90,
      planCodeSnapshot: fixture.plan.code,
      planNameSnapshot: fixture.plan.name,
      depositorName: "엄 동건",
      status: "PENDING",
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.paymentRequest.id).toBe(first.paymentRequest.id);
    expect(await database.paymentRequest.count({ where: { familyId: fixture.family.id } })).toBe(1);
    expect(
      await database.paymentAuditLog.count({
        where: {
          paymentRequestId: first.paymentRequest.id,
          action: "PAYMENT_REQUESTED",
        },
      }),
    ).toBe(1);
  });

  it("confirms once, grants the period, and mirrors paidUntil to every family app key", async () => {
    const fixture = await createFixture("confirm");
    const payment = await submit(fixture);
    const confirmedAt = new Date("2026-07-30T03:00:00.000Z");

    const first = await confirmPaymentRequest(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
        receivedAmountKrw: "39000",
        receivedDate: "2026-07-30",
        now: confirmedAt,
      },
      database,
    );
    const repeated = await confirmPaymentRequest(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
        receivedAmountKrw: 39_000,
        receivedDate: "2026-07-30",
        now: new Date("2026-07-31T00:00:00.000Z"),
      },
      database,
    );

    expect(first.alreadyConfirmed).toBe(false);
    expect(first.subscription.startsAt).toEqual(confirmedAt);
    expect(first.subscription.expiresAt).toEqual(new Date("2026-10-28T03:00:00.000Z"));
    expect(repeated.alreadyConfirmed).toBe(true);
    expect(repeated.grant.id).toBe(first.grant.id);
    expect(await database.subscriptionGrant.count({ where: { paymentRequestId: payment.id } })).toBe(
      1,
    );

    const key = await database.appAccessKey.findFirstOrThrow({
      where: { familyId: fixture.family.id },
    });
    expect(key.paidUntil).toEqual(first.subscription.expiresAt);
    expect(
      await database.paymentAuditLog.count({
        where: { paymentRequestId: payment.id, action: "PAYMENT_CONFIRMED" },
      }),
    ).toBe(1);
  });

  it("extends an active family subscription from its current expiration", async () => {
    const fixture = await createFixture("extend");
    const firstPayment = await submit(fixture, new Date("2026-07-30T00:00:00.000Z"));
    const first = await confirmPaymentRequest(
      {
        paymentRequestId: firstPayment.id,
        actorId: "owner",
        receivedAmountKrw: 39_000,
        receivedDate: "2026-07-30",
        now: new Date("2026-07-30T03:00:00.000Z"),
      },
      database,
    );
    const secondPayment = await submit(fixture, new Date("2026-08-01T00:00:00.000Z"));
    const second = await confirmPaymentRequest(
      {
        paymentRequestId: secondPayment.id,
        actorId: "owner",
        receivedAmountKrw: 39_000,
        receivedDate: "2026-08-01",
        now: new Date("2026-08-01T03:00:00.000Z"),
      },
      database,
    );

    expect(second.grant.startsAt).toEqual(first.subscription.expiresAt);
    expect(second.subscription.expiresAt).toEqual(new Date("2027-01-26T03:00:00.000Z"));
    expect(
      await database.subscriptionGrant.count({ where: { familyId: fixture.family.id } }),
    ).toBe(2);
  });

  it("rejects or expires only pending requests and keeps repeated actions idempotent", async () => {
    const rejectedFixture = await createFixture("reject");
    const rejectedPayment = await submit(rejectedFixture);
    const rejected = await rejectPaymentRequest(
      {
        paymentRequestId: rejectedPayment.id,
        actorId: "owner",
        adminMemo: "입금내역 불일치",
        now: new Date("2026-07-31T00:00:00.000Z"),
      },
      database,
    );
    const repeatedRejection = await rejectPaymentRequest(
      {
        paymentRequestId: rejectedPayment.id,
        actorId: "owner",
      },
      database,
    );

    expect(rejected.alreadyProcessed).toBe(false);
    expect(rejected.paymentRequest.status).toBe("REJECTED");
    expect(repeatedRejection.alreadyProcessed).toBe(true);

    const expiredFixture = await createFixture("expire");
    const expiredPayment = await submit(expiredFixture);
    const expired = await expirePaymentRequest(
      {
        paymentRequestId: expiredPayment.id,
        actorId: "owner",
        now: new Date("2026-08-10T00:00:00.000Z"),
      },
      database,
    );

    expect(expired.paymentRequest.status).toBe("EXPIRED");
    await expect(
      confirmPaymentRequest(
        {
          paymentRequestId: expiredPayment.id,
          actorId: "owner",
          receivedAmountKrw: 39_000,
          receivedDate: "2026-08-10",
        },
        database,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("supports refund request rejection and a later full refund exactly once", async () => {
    const fixture = await createFixture("refund");
    const payment = await submitAndConfirm(fixture);

    const requested = await requestPaymentRefund(
      {
        paymentRequestId: payment.id,
        requestedById: fixture.parent.id,
        reason: "사용하지 않게 됐습니다.",
        now: new Date("2026-07-31T00:00:00.000Z"),
      },
      database,
    );
    const repeatedRequest = await requestPaymentRefund(
      {
        paymentRequestId: payment.id,
        requestedById: fixture.parent.id,
      },
      database,
    );
    expect(requested.alreadyRequested).toBe(false);
    expect(repeatedRequest.alreadyRequested).toBe(true);

    const rejected = await rejectPaymentRefund(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
        adminMemo: "환불 요청 철회 확인",
        now: new Date("2026-07-31T01:00:00.000Z"),
      },
      database,
    );
    const repeatedRejection = await rejectPaymentRefund(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
      },
      database,
    );
    expect(rejected.alreadyRejected).toBe(false);
    expect(repeatedRejection.alreadyRejected).toBe(true);

    await requestPaymentRefund(
      {
        paymentRequestId: payment.id,
        requestedById: fixture.parent.id,
        reason: "전액 환불",
        now: new Date("2026-08-01T00:00:00.000Z"),
      },
      database,
    );
    const completed = await completePaymentRefund(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
        now: new Date("2026-08-01T01:00:00.000Z"),
      },
      database,
    );
    const repeatedCompletion = await completePaymentRefund(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
      },
      database,
    );

    expect(completed.alreadyCompleted).toBe(false);
    expect(completed.paymentRequest).toMatchObject({
      status: "REFUNDED",
      refundAmountKrw: 39_000,
    });
    expect(completed.grant.status).toBe("CANCELLED");
    expect(completed.subscription.status).toBe("CANCELLED");
    expect(repeatedCompletion.alreadyCompleted).toBe(true);

    const key = await database.appAccessKey.findFirstOrThrow({
      where: { familyId: fixture.family.id },
    });
    expect(key.paidUntil).toBeNull();
    expect(
      await database.paymentAuditLog.count({
        where: { paymentRequestId: payment.id, action: "REFUND_COMPLETED" },
      }),
    ).toBe(1);
  });

  it("rolls back a refund when its grant is not the latest active family grant", async () => {
    const fixture = await createFixture("refund-order");
    const firstPayment = await submitAndConfirm(fixture);
    const secondPayment = await submit(fixture, new Date("2026-08-01T00:00:00.000Z"));
    await confirmPaymentRequest(
      {
        paymentRequestId: secondPayment.id,
        actorId: "owner",
        receivedAmountKrw: 39_000,
        receivedDate: "2026-08-01",
        now: new Date("2026-08-01T01:00:00.000Z"),
      },
      database,
    );
    await requestPaymentRefund(
      {
        paymentRequestId: firstPayment.id,
        requestedById: fixture.parent.id,
        now: new Date("2026-08-02T00:00:00.000Z"),
      },
      database,
    );

    await expect(
      completePaymentRefund(
        {
          paymentRequestId: firstPayment.id,
          actorId: "owner",
          now: new Date("2026-08-02T01:00:00.000Z"),
        },
        database,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const unchanged = await database.paymentRequest.findUniqueOrThrow({
      where: { id: firstPayment.id },
    });
    expect(unchanged.status).toBe("REFUND_REQUESTED");
    expect(unchanged.refundAmountKrw).toBe(0);
  });

  it("updates an admin memo with a single audit log and treats the same value as unchanged", async () => {
    const fixture = await createFixture("memo");
    const payment = await submit(fixture);

    const changed = await updatePaymentAdminMemo(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
        adminMemo: "  입금 확인 필요  ",
      },
      database,
    );
    const unchanged = await updatePaymentAdminMemo(
      {
        paymentRequestId: payment.id,
        actorId: "owner",
        adminMemo: "입금 확인 필요",
      },
      database,
    );

    expect(changed.changed).toBe(true);
    expect(changed.paymentRequest.adminMemo).toBe("입금 확인 필요");
    expect(unchanged.changed).toBe(false);
    expect(
      await database.paymentAuditLog.count({
        where: { paymentRequestId: payment.id, action: "ADMIN_MEMO_UPDATED" },
      }),
    ).toBe(1);
  });
});

async function createFixture(suffix: string) {
  const family = await database.family.create({
    data: {
      name: `테스트 가족 ${suffix}`,
    },
  });
  const parent = await database.parentUser.create({
    data: {
      familyId: family.id,
      email: `${suffix}-${family.id}@example.test`,
      displayName: "테스트 부모",
      passwordHash: "not-a-real-password-hash",
    },
  });
  const plan = await database.paymentPlan.create({
    data: {
      code: `PLAN-${suffix}-${family.id}`,
      name: "베타 3개월 이용권",
      priceKrw: 39_000,
      durationDays: 90,
      isActive: true,
    },
  });
  await database.appAccessKey.create({
    data: {
      familyId: family.id,
      name: "테스트 앱",
      keyHash: `hash-${family.id}`,
      keyPrefix: "st_app_test",
      trialStartedAt: new Date("2026-07-01T00:00:00.000Z"),
      trialEndsAt: new Date("2026-07-15T00:00:00.000Z"),
    },
  });

  return { family, parent, plan };
}

async function submit(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  now = new Date("2026-07-30T00:00:00.000Z"),
) {
  const result = await createPaymentRequest(
    {
      familyId: fixture.family.id,
      requestedById: fixture.parent.id,
      planId: fixture.plan.id,
      depositorName: "테스트 입금자",
      expectedDepositDate: now.toISOString().slice(0, 10),
      now,
    },
    database,
  );

  return result.paymentRequest;
}

async function submitAndConfirm(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const payment = await submit(fixture);
  await confirmPaymentRequest(
    {
      paymentRequestId: payment.id,
      actorId: "owner",
      receivedAmountKrw: payment.amountKrw,
      receivedDate: "2026-07-30",
      now: new Date("2026-07-30T03:00:00.000Z"),
    },
    database,
  );

  return payment;
}

async function createTestSchema(client: PrismaClient): Promise<void> {
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE "Family" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "wifiRequired" BOOLEAN NOT NULL DEFAULT true,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );`,
    `CREATE TABLE "ParentUser" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "familyId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "lastLoginAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ParentUser_familyId_fkey"
        FOREIGN KEY ("familyId") REFERENCES "Family" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX "ParentUser_email_key" ON "ParentUser"("email");',
    `CREATE TABLE "PaymentPlan" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "priceKrw" INTEGER NOT NULL,
      "durationDays" INTEGER NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );`,
    'CREATE UNIQUE INDEX "PaymentPlan_code_key" ON "PaymentPlan"("code");',
    `CREATE TABLE "PaymentRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "requestNo" TEXT NOT NULL,
      "familyId" TEXT NOT NULL,
      "requestedById" TEXT NOT NULL,
      "planId" TEXT NOT NULL,
      "planCodeSnapshot" TEXT NOT NULL,
      "planNameSnapshot" TEXT NOT NULL,
      "amountKrw" INTEGER NOT NULL,
      "durationDaysSnapshot" INTEGER NOT NULL,
      "depositorName" TEXT NOT NULL,
      "expectedDepositDate" TEXT,
      "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "pendingKey" TEXT,
      "confirmedAt" DATETIME,
      "confirmedBy" TEXT,
      "receivedAmountKrw" INTEGER,
      "receivedDate" TEXT,
      "rejectedAt" DATETIME,
      "rejectedBy" TEXT,
      "expiredAt" DATETIME,
      "refundRequestedAt" DATETIME,
      "refundedAt" DATETIME,
      "refundedBy" TEXT,
      "refundAmountKrw" INTEGER NOT NULL DEFAULT 0,
      "userMemo" TEXT,
      "adminMemo" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PaymentRequest_familyId_fkey"
        FOREIGN KEY ("familyId") REFERENCES "Family" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "PaymentRequest_requestedById_fkey"
        FOREIGN KEY ("requestedById") REFERENCES "ParentUser" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "PaymentRequest_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "PaymentPlan" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX "PaymentRequest_requestNo_key" ON "PaymentRequest"("requestNo");',
    'CREATE UNIQUE INDEX "PaymentRequest_pendingKey_key" ON "PaymentRequest"("pendingKey");',
    `CREATE TABLE "FamilySubscription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "familyId" TEXT NOT NULL,
      "startsAt" DATETIME NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "version" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "FamilySubscription_familyId_fkey"
        FOREIGN KEY ("familyId") REFERENCES "Family" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX "FamilySubscription_familyId_key" ON "FamilySubscription"("familyId");',
    `CREATE TABLE "SubscriptionGrant" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "familyId" TEXT NOT NULL,
      "subscriptionId" TEXT NOT NULL,
      "paymentRequestId" TEXT NOT NULL,
      "startsAt" DATETIME NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "durationDays" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "cancelledAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "SubscriptionGrant_familyId_fkey"
        FOREIGN KEY ("familyId") REFERENCES "Family" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "SubscriptionGrant_subscriptionId_fkey"
        FOREIGN KEY ("subscriptionId") REFERENCES "FamilySubscription" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "SubscriptionGrant_paymentRequestId_fkey"
        FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX "SubscriptionGrant_paymentRequestId_key" ON "SubscriptionGrant"("paymentRequestId");',
    `CREATE TABLE "PaymentRefund" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "paymentRequestId" TEXT NOT NULL,
      "requestedById" TEXT,
      "status" TEXT NOT NULL DEFAULT 'REQUESTED',
      "amountKrw" INTEGER NOT NULL,
      "reason" TEXT,
      "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "processedAt" DATETIME,
      "processedBy" TEXT,
      "adminMemo" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PaymentRefund_paymentRequestId_fkey"
        FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "PaymentRefund_requestedById_fkey"
        FOREIGN KEY ("requestedById") REFERENCES "ParentUser" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    `CREATE TABLE "PaymentAuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "paymentRequestId" TEXT NOT NULL,
      "actorType" TEXT NOT NULL,
      "actorId" TEXT,
      "action" TEXT NOT NULL,
      "previousStatus" TEXT,
      "nextStatus" TEXT,
      "memo" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentAuditLog_paymentRequestId_fkey"
        FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    `CREATE TABLE "AppAccessKey" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "familyId" TEXT,
      "name" TEXT NOT NULL,
      "keyHash" TEXT NOT NULL,
      "keyPrefix" TEXT NOT NULL,
      "installationId" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "trialStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "trialEndsAt" DATETIME NOT NULL,
      "paidUntil" DATETIME,
      "lastSyncedAt" DATETIME,
      "registeredAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "AppAccessKey_familyId_fkey"
        FOREIGN KEY ("familyId") REFERENCES "Family" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );`,
    'CREATE UNIQUE INDEX "AppAccessKey_keyHash_key" ON "AppAccessKey"("keyHash");',
  ];

  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
}
function cleanupDatabaseArtifacts(): void {
  for (const artifact of databaseArtifacts) {
    if (existsSync(artifact)) {
      unlinkSync(artifact);
    }
  }
}
