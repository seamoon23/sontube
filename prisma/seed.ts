import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  for (const tag of starterTags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      create: tag,
      update: tag,
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "show_hot_tags" },
    create: { key: "show_hot_tags", value: "true" },
    update: { value: "true" },
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
