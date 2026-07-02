export const KIDS_PLAYLIST_STORAGE_KEY = "sontube:kids-playlist";
export const MAX_KIDS_PLAYLIST_ITEMS = 20;

export type KidsPlaylistItem = {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationText: string | null;
};

export function addKidsPlaylistItem(
  currentItems: KidsPlaylistItem[],
  nextItem: KidsPlaylistItem,
): KidsPlaylistItem[] {
  const normalized = normalizeKidsPlaylist(currentItems);
  if (normalized.some((item) => item.id === nextItem.id)) {
    return normalized;
  }

  return [...normalized, nextItem].slice(0, MAX_KIDS_PLAYLIST_ITEMS);
}

export function removeKidsPlaylistItem(currentItems: KidsPlaylistItem[], id: string): KidsPlaylistItem[] {
  return normalizeKidsPlaylist(currentItems).filter((item) => item.id !== id);
}

export function normalizeKidsPlaylist(value: unknown): KidsPlaylistItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: KidsPlaylistItem[] = [];

  for (const item of value) {
    if (!isPlaylistCandidate(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push({
      id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      durationText: item.durationText ?? null,
    });
  }

  return items.slice(0, MAX_KIDS_PLAYLIST_ITEMS);
}

function isPlaylistCandidate(value: unknown): value is KidsPlaylistItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<KidsPlaylistItem>;

  return Boolean(
    item.id &&
      typeof item.id === "string" &&
      item.title &&
      typeof item.title === "string" &&
      item.thumbnailUrl &&
      typeof item.thumbnailUrl === "string",
  );
}
