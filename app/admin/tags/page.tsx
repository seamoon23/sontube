import { TagManager } from "@/components/admin/tag-manager";
import { prisma } from "@/lib/db";

export default async function AdminTagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-ocean">태그 관리</p>
        <h2 className="text-2xl font-bold text-ink">영상 분류 태그</h2>
      </div>
      <TagManager
        tags={tags.map((tag) => ({
          ...tag,
          lastUsedAt: tag.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
