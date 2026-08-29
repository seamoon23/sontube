import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_BOOTSTRAP_EMAIL = "parent@sontube.local";
const DEFAULT_BOOTSTRAP_FAMILY_NAME = "SonTube 가족";

const starterTags = [
  { name: "동물", slug: "animals", color: "#4d7c0f", icon: "paw", sortOrder: 10 },
  { name: "아기", slug: "baby", color: "#db2777", icon: "smile", sortOrder: 20 },
  { name: "음식", slug: "food", color: "#c2410c", icon: "utensils", sortOrder: 30 },
  { name: "여행", slug: "travel", color: "#0369a1", icon: "map", sortOrder: 40 },
  { name: "풍경", slug: "scenery", color: "#0f766e", icon: "mountain", sortOrder: 50 },
  { name: "자기계발", slug: "self", color: "#7c3aed", icon: "spark", sortOrder: 60 },
  { name: "학습", slug: "learning", color: "#2563eb", icon: "book", sortOrder: 70 },
  { name: "만들기", slug: "making", color: "#ca8a04", icon: "brush", sortOrder: 80 },
  { name: "운동", slug: "exercise", color: "#16a34a", icon: "move", sortOrder: 90 },
  { name: "과학", slug: "science", color: "#0891b2", icon: "flask", sortOrder: 100 },
  { name: "영어", slug: "english", color: "#4338ca", icon: "abc", sortOrder: 110 },
];

const starterPaymentPlans = [
  {
    code: "BETA_3M",
    name: "베타 3개월",
    priceKrw: 0,
    durationDays: 90,
    isActive: false,
    displayOrder: 10,
  },
  {
    code: "STANDARD_1Y",
    name: "스탠다드 12개월",
    priceKrw: 0,
    durationDays: 365,
    isActive: false,
    displayOrder: 20,
  },
];

async function main() {
  const bootstrapFamilyId = await seedBootstrapFamily();

  if (bootstrapFamilyId) {
    await prisma.$transaction(async (tx) => {
      await tx.video.updateMany({
        where: { familyId: null },
        data: { familyId: bootstrapFamilyId },
      });
      await tx.tag.updateMany({
        where: { familyId: null },
        data: { familyId: bootstrapFamilyId },
      });
      await tx.appAccessKey.updateMany({
        where: { familyId: null },
        data: { familyId: bootstrapFamilyId },
      });

      for (const tag of starterTags) {
        await tx.tag.upsert({
          where: {
            familyId_slug: {
              familyId: bootstrapFamilyId,
              slug: tag.slug,
            },
          },
          create: {
            ...tag,
            familyId: bootstrapFamilyId,
          },
          update: tag,
        });
      }
    });
  } else {
    console.warn(
      "ADMIN_PASSWORD_HASH와 SESSION_SECRET이 모두 설정되지 않아 bootstrap 가족과 시작 태그 생성을 건너뜁니다.",
    );
  }

  for (const plan of starterPaymentPlans) {
    await prisma.paymentPlan.upsert({
      where: { code: plan.code },
      create: plan,
      update: {},
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "show_hot_tags" },
    create: { key: "show_hot_tags", value: "true" },
    update: { value: "true" },
  });

  await prisma.appSetting.upsert({
    where: { key: "wifi_required" },
    create: { key: "wifi_required", value: "true" },
    update: {},
  });
}

async function seedBootstrapFamily(): Promise<string | null> {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();

  if (!passwordHash || !sessionSecret) {
    return null;
  }

  const email =
    process.env.PARENT_BOOTSTRAP_EMAIL?.trim().toLowerCase() ||
    DEFAULT_BOOTSTRAP_EMAIL;
  const configuredFamilyName = process.env.PARENT_BOOTSTRAP_FAMILY_NAME?.trim();
  const familyName = configuredFamilyName || DEFAULT_BOOTSTRAP_FAMILY_NAME;

  return prisma.$transaction(async (tx) => {
    const existingParent = await tx.parentUser.findUnique({
      where: { email },
      select: { id: true, familyId: true },
    });

    if (existingParent) {
      await tx.parentUser.update({
        where: { id: existingParent.id },
        data: { passwordHash },
      });

      if (configuredFamilyName) {
        await tx.family.update({
          where: { id: existingParent.familyId },
          data: { name: configuredFamilyName },
        });
      }

      return existingParent.familyId;
    }

    const family = await tx.family.create({
      data: {
        name: familyName,
        users: {
          create: {
            email,
            displayName: "보호자",
            passwordHash,
          },
        },
      },
      select: { id: true },
    });

    return family.id;
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
