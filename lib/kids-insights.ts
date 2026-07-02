import { getKidsSignalLabel, KIDS_SIGNAL_TYPES, type KidsSignalType } from "@/lib/kids-signals";

export type KidsInsightRecord = {
  type: KidsSignalType;
  video: {
    id: string;
    title: string;
    searchKeywords: string | null;
    tags: readonly string[];
  };
};

export type CountedLabel = {
  label: string;
  count: number;
};

export type CountedVideo = {
  id: string;
  title: string;
  count: number;
};

export type KidsInsightSummary = {
  totalSignals: number;
  signalCounts: Partial<Record<KidsSignalType, number>>;
  topVideos: CountedVideo[];
  topKeywords: CountedLabel[];
  topTags: CountedLabel[];
};

export function summarizeKidsSignals(records: readonly KidsInsightRecord[]): KidsInsightSummary {
  const signalCounts = new Map<KidsSignalType, number>();
  const videoCounts = new Map<string, CountedVideo>();
  const keywordCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const record of records) {
    signalCounts.set(record.type, (signalCounts.get(record.type) ?? 0) + 1);

    const existingVideo = videoCounts.get(record.video.id);
    videoCounts.set(record.video.id, {
      id: record.video.id,
      title: record.video.title,
      count: (existingVideo?.count ?? 0) + 1,
    });

    for (const keyword of splitKeywords(record.video.searchKeywords)) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }

    for (const tag of record.video.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    totalSignals: records.length,
    signalCounts: Object.fromEntries(signalCounts),
    topVideos: sortCounts(Array.from(videoCounts.values())).slice(0, 8),
    topKeywords: sortLabelCounts(keywordCounts).slice(0, 12),
    topTags: sortLabelCounts(tagCounts).slice(0, 12),
  };
}

export function buildKidsInsightPrompt(summary: KidsInsightSummary): string {
  const signalLines = KIDS_SIGNAL_TYPES.map((type) => ({ type, count: summary.signalCounts[type] ?? 0 }))
    .filter(({ count }) => count > 0)
    .map(({ type, count }) => `- ${getKidsSignalLabel(type)}: ${count}`)
    .join("\n");
  const videoLines = summary.topVideos.map((video) => `- ${video.title}: ${video.count}`).join("\n");
  const keywordLines = summary.topKeywords.map((keyword) => `- ${keyword.label}: ${keyword.count}`).join("\n");
  const tagLines = summary.topTags.map((tag) => `- ${tag.label}: ${tag.count}`).join("\n");

  return [
    "다음은 SonTube 안에서 보호자가 직접 등록한 승인 영상에 대한 아이의 관심 신호 요약입니다.",
    "외부 API 없이 아래 통계만 보고, 아이에게 더 넣어주면 좋을 영상 방향을 제안해 주세요.",
    "",
    `총 신호 수: ${summary.totalSignals}`,
    "",
    "반응 종류:",
    signalLines || "- 아직 없음",
    "",
    "관심이 많이 모인 영상:",
    videoLines || "- 아직 없음",
    "",
    "자주 나온 보호자 키워드:",
    keywordLines || "- 아직 없음",
    "",
    "자주 나온 태그:",
    tagLines || "- 아직 없음",
    "",
    "요청:",
    "1. 아이가 좋아하는 주제 패턴을 3가지로 요약해 주세요.",
    "2. 다음에 보호자가 직접 검토해 추가하면 좋을 영상 후보 방향을 5가지 제안해 주세요.",
    "3. 너무 자극적인 추천으로 흐르지 않도록 주의할 점을 알려 주세요.",
  ].join("\n");
}

function splitKeywords(value: string | null): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[,\n]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  );
}

function sortCounts<T extends { count: number; title?: string; label?: string }>(items: T[]): T[] {
  return items.sort((left, right) => {
    const countDelta = right.count - left.count;
    if (countDelta !== 0) return countDelta;
    return (left.title ?? left.label ?? "").localeCompare(right.title ?? right.label ?? "", "ko");
  });
}

function sortLabelCounts(counts: Map<string, number>): CountedLabel[] {
  return Array.from(counts, ([label, count], index) => ({ label, count, index }))
    .sort((left, right) => {
      const countDelta = right.count - left.count;
      if (countDelta !== 0) return countDelta;
      return left.index - right.index;
    })
    .map(({ label, count }) => ({ label, count }));
}
