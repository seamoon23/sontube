export function slugifyTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitTagNames(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  );
}
