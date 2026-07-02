export type RecommendationTag = {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
  lastUsedAt: Date | string | null;
  isActive: boolean;
};

export type RecommendationVideo = {
  id: string;
  title: string;
  description: string | null;
  tags: RecommendationTag[];
};

export type RecommendTagsInput = {
  title: string;
  description?: string | null;
  tags: RecommendationTag[];
  existingVideos: RecommendationVideo[];
  now?: Date;
  limit?: number;
};

const KEYWORD_HINTS: Record<string, string[]> = {
  animals: ["동물", "강아지", "개", "고양이", "아기동물", "펫", "animal", "cat", "dog"],
  baby: ["아기", "유아", "baby"],
  food: ["음식", "요리", "간식", "레시피", "먹방", "food", "cook"],
  travel: ["여행", "바다", "산", "도시", "기차", "travel", "trip"],
  scenery: ["풍경", "자연", "하늘", "숲", "scenery", "nature"],
  self: ["자기계발", "습관", "정리", "마음", "self"],
  learning: ["학습", "공부", "배우기", "learn"],
  making: ["만들기", "공작", "그리기", "종이접기", "craft", "make"],
  exercise: ["운동", "체조", "스트레칭", "exercise"],
  science: ["과학", "실험", "우주", "공룡", "science", "experiment"],
  english: ["영어", "abc", "phonics", "알파벳", "english"],
};

export function recommendTags(input: RecommendTagsInput): RecommendationTag[] {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 8;
  const text = normalize(`${input.title} ${input.description ?? ""}`);
  const inputTokens = tokenize(text);
  const scores = new Map<string, number>();
  const tagById = new Map(input.tags.filter((tag) => tag.isActive).map((tag) => [tag.id, tag]));

  for (const tag of tagById.values()) {
    addScore(scores, tag.id, Math.min(tag.usageCount, 10) * 0.5);

    const daysSinceUse = diffDays(now, tag.lastUsedAt);
    if (daysSinceUse !== null && daysSinceUse <= 7) {
      addScore(scores, tag.id, 5);
    } else if (daysSinceUse !== null && daysSinceUse <= 30) {
      addScore(scores, tag.id, 1);
    }

    if (matchesTagText(tag, text)) {
      addScore(scores, tag.id, 8);
    }
  }

  for (const video of input.existingVideos) {
    const videoText = normalize(`${video.title} ${video.description ?? ""}`);
    const overlap = countTokenOverlap(inputTokens, tokenize(videoText));

    if (overlap > 0) {
      for (const tag of video.tags) {
        if (tagById.has(tag.id)) {
          addScore(scores, tag.id, 5 + overlap);
        }
      }
    }
  }

  return Array.from(tagById.values())
    .sort((left, right) => {
      const scoreDelta = (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0);
      if (scoreDelta !== 0) return scoreDelta;

      const usageDelta = right.usageCount - left.usageCount;
      if (usageDelta !== 0) return usageDelta;

      return left.name.localeCompare(right.name, "ko");
    })
    .slice(0, limit);
}

function matchesTagText(tag: RecommendationTag, normalizedText: string): boolean {
  if (!normalizedText) return false;

  const candidates = new Set([
    normalize(tag.name),
    normalize(tag.slug),
    ...(KEYWORD_HINTS[tag.slug] ?? []).map(normalize),
  ]);

  for (const candidate of candidates) {
    if (candidate && normalizedText.includes(candidate)) {
      return true;
    }
  }

  return false;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): Set<string> {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length >= 2));
}

function countTokenOverlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function diffDays(now: Date, value: Date | string | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function addScore(scores: Map<string, number>, tagId: string, amount: number): void {
  scores.set(tagId, (scores.get(tagId) ?? 0) + amount);
}
