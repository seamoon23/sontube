export const MAX_CHANNEL_DISPLAY_NAME_LENGTH = 80;

const ZERO_WIDTH_CHARACTERS = /[\u180e\u200b-\u200d\u2060\ufeff]/gu;

export function cleanChannelDisplayName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeChannelName(value: string): string {
  return cleanChannelDisplayName(value).toLowerCase();
}
