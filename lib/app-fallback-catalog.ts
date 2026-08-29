export type AppFallbackTag = {
  name: string;
  slug: string;
};

export type AppFallbackChannel = {
  id: string;
  name: string;
};

export type AppFallbackVideo = {
  id: string;
  title: string;
  description: string;
  durationText: string;
  emoji: string;
  accent: string;
  channel: AppFallbackChannel;
  tags: AppFallbackTag[];
};

export const APP_FALLBACK_VIDEOS: AppFallbackVideo[] = [
  {
    id: "sample-forest-animals",
    title: "숲속 동물 관찰",
    description: "다람쥐와 새를 천천히 관찰하는 샘플 카드",
    durationText: "4:12",
    emoji: "🐿️",
    accent: "#d9f99d",
    channel: channel("sample-nature-lab", "호기심 자연 연구소"),
    tags: [tag("동물", "animals"), tag("자연", "nature")],
  },
  {
    id: "sample-ocean",
    title: "바닷속 친구들",
    description: "물고기와 산호를 살펴보는 샘플 카드",
    durationText: "6:05",
    emoji: "🐠",
    accent: "#bae6fd",
    channel: channel("sample-nature-lab", "호기심 자연 연구소"),
    tags: [tag("동물", "animals"), tag("과학", "science")],
  },
  {
    id: "sample-space",
    title: "별과 행성 여행",
    description: "태양계의 행성을 찾아보는 샘플 카드",
    durationText: "5:30",
    emoji: "🪐",
    accent: "#ddd6fe",
    channel: channel("sample-nature-lab", "호기심 자연 연구소"),
    tags: [tag("과학", "science"), tag("우주", "space")],
  },
  {
    id: "sample-paper-craft",
    title: "색종이 동물 만들기",
    description: "접고 꾸미는 순서를 확인하는 샘플 카드",
    durationText: "8:20",
    emoji: "✂️",
    accent: "#fde68a",
    channel: channel("sample-play-studio", "손끝 놀이 작업실"),
    tags: [tag("만들기", "making"), tag("동물", "animals")],
  },
  {
    id: "sample-english-song",
    title: "인사말 영어 노래",
    description: "짧은 인사 표현을 따라 하는 샘플 카드",
    durationText: "3:10",
    emoji: "🎵",
    accent: "#fecdd3",
    channel: channel("sample-story-radio", "포근한 이야기 라디오"),
    tags: [tag("영어", "english"), tag("음악", "music")],
  },
  {
    id: "sample-stretch",
    title: "아침 쭉쭉 스트레칭",
    description: "가볍게 몸을 움직이는 샘플 카드",
    durationText: "7:00",
    emoji: "🤸",
    accent: "#bbf7d0",
    channel: channel("sample-play-studio", "손끝 놀이 작업실"),
    tags: [tag("운동", "exercise"), tag("생활", "daily")],
  },
  {
    id: "sample-cooking",
    title: "알록달록 과일 접시",
    description: "과일 이름과 색을 살펴보는 샘플 카드",
    durationText: "4:45",
    emoji: "🍓",
    accent: "#fed7aa",
    channel: channel("sample-play-studio", "손끝 놀이 작업실"),
    tags: [tag("음식", "food"), tag("학습", "learning")],
  },
  {
    id: "sample-dinosaur",
    title: "공룡 발자국 찾기",
    description: "서로 다른 발자국을 비교하는 샘플 카드",
    durationText: "5:55",
    emoji: "🦕",
    accent: "#ccfbf1",
    channel: channel("sample-nature-lab", "호기심 자연 연구소"),
    tags: [tag("과학", "science"), tag("학습", "learning")],
  },
  {
    id: "sample-train",
    title: "기차로 떠나는 작은 여행",
    description: "창밖 풍경을 감상하는 샘플 카드",
    durationText: "9:15",
    emoji: "🚂",
    accent: "#bfdbfe",
    channel: channel("sample-story-radio", "포근한 이야기 라디오"),
    tags: [tag("여행", "travel"), tag("풍경", "scenery")],
  },
  {
    id: "sample-bedtime",
    title: "잠들기 전 구름 이야기",
    description: "차분한 그림을 보는 샘플 카드",
    durationText: "6:40",
    emoji: "☁️",
    accent: "#e2e8f0",
    channel: channel("sample-story-radio", "포근한 이야기 라디오"),
    tags: [tag("이야기", "story"), tag("생활", "daily")],
  },
];

export function filterFallbackVideos(
  videos: AppFallbackVideo[],
  query: string,
  selectedTag: string,
  selectedChannelId: string | null = null,
): AppFallbackVideo[] {
  const normalizedQuery = query.trim().toLowerCase();

  return videos.filter((video) => {
    const matchesTag = selectedTag ? video.tags.some((item) => item.slug === selectedTag) : true;
    const matchesChannel = selectedChannelId ? video.channel.id === selectedChannelId : true;
    const haystack = [video.title, video.description, ...video.tags.map((item) => item.name)].join(" ").toLowerCase();
    return matchesTag && matchesChannel && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}

export function buildFallbackTags(videos: AppFallbackVideo[]): AppFallbackTag[] {
  const tags = new Map<string, AppFallbackTag>();
  for (const video of videos) {
    for (const item of video.tags) tags.set(item.slug, item);
  }
  return Array.from(tags.values()).sort((left, right) => left.name.localeCompare(right.name, "ko-KR"));
}

function tag(name: string, slug: string): AppFallbackTag {
  return { name, slug };
}

function channel(id: string, name: string): AppFallbackChannel {
  return { id, name };
}
