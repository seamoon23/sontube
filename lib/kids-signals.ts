export const KIDS_SIGNAL_TYPES = [
  "LIKE",
  "REWATCH",
  "CURIOUS",
  "FUNNY",
  "TOO_HARD",
  "DISLIKE",
  "PLAYLIST",
] as const;

export type KidsSignalType = (typeof KIDS_SIGNAL_TYPES)[number];
export type KidsFeedbackSignalType = Exclude<KidsSignalType, "PLAYLIST">;

export const KIDS_SIGNAL_OPTIONS: Array<{
  type: KidsFeedbackSignalType;
  label: string;
  tone: "positive" | "curious" | "soft" | "hard";
}> = [
  { type: "LIKE", label: "좋아요", tone: "positive" },
  { type: "REWATCH", label: "다시 볼래요", tone: "positive" },
  { type: "CURIOUS", label: "궁금해요", tone: "curious" },
  { type: "FUNNY", label: "웃겨요", tone: "soft" },
  { type: "TOO_HARD", label: "어려워요", tone: "hard" },
  { type: "DISLIKE", label: "별로예요", tone: "hard" },
];

const KIDS_SIGNAL_LABELS: Record<KidsSignalType, string> = {
  LIKE: "좋아요",
  REWATCH: "다시 볼래요",
  CURIOUS: "궁금해요",
  FUNNY: "웃겨요",
  TOO_HARD: "어려워요",
  DISLIKE: "별로예요",
  PLAYLIST: "내 목록 담기",
};

export function isKidsSignalType(value: string): value is KidsSignalType {
  return (KIDS_SIGNAL_TYPES as readonly string[]).includes(value);
}

export function isKidsFeedbackSignal(value: string): value is KidsFeedbackSignalType {
  return isKidsSignalType(value) && value !== "PLAYLIST";
}

export function getKidsSignalLabel(type: KidsSignalType): string {
  return KIDS_SIGNAL_LABELS[type];
}
