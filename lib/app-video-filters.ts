import type { AppCatalogVideo } from "@/lib/app-catalog";

export function filterAppCatalogVideos(
  videos: AppCatalogVideo[],
  query: string,
  selectedTag: string,
  selectedChannelId: string | null = null,
): AppCatalogVideo[] {
  const normalizedQuery = query.trim().toLowerCase();

  return videos.filter((video) => {
    const matchesTag = selectedTag ? video.tags.some((tag) => tag.slug === selectedTag) : true;
    const matchesChannel = selectedChannelId ? video.channel?.id === selectedChannelId : true;
    const haystack = [video.title, video.description, video.searchKeywords, ...video.tags.map((tag) => tag.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;

    return matchesTag && matchesChannel && matchesQuery;
  });
}
