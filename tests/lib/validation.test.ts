import { describe, expect, it } from "vitest";
import { videoClientSchema } from "@/lib/validation";

const validVideo = {
  originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "테스트 영상",
  description: "",
  searchKeywords: "테스트",
  durationText: "03:32",
  channelMode: "NONE" as const,
  channelId: "",
  newChannelName: "",
  safetyStatus: "PARENT_CHECKED" as const,
  isPublished: true,
  isLitePublished: true,
  liteSortOrder: "12",
  isParentRecommended: false,
  playMode: "SINGLE_THEN_CLOSE" as const,
  thumbnailType: "YOUTUBE" as const,
  quickNewTags: "",
  tagIds: [],
};

describe("videoClientSchema Lite publication", () => {
  it("accepts an explicitly approved public video and coerces its order", () => {
    const parsed = videoClientSchema.parse(validVideo);

    expect(parsed.isLitePublished).toBe(true);
    expect(parsed.liteSortOrder).toBe(12);
  });

  it.each([
    { input: { ...validVideo, isPublished: false }, label: "아이 화면 비공개" },
    { input: { ...validVideo, safetyStatus: "NEEDS_REVIEW" as const }, label: "검토 필요" },
    { input: { ...validVideo, safetyStatus: "HIDDEN" as const }, label: "숨김" },
  ])("rejects Lite publication when the video is $label", ({ input }) => {
    const parsed = videoClientSchema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["isLitePublished"],
            message: "Lite 공개 영상은 보호자 확인 완료 및 아이 화면 공개 상태여야 합니다.",
          }),
        ]),
      );
    }
  });

  it.each([-1, 10_000, "not-a-number"])("rejects invalid Lite sort order %s", (liteSortOrder) => {
    const parsed = videoClientSchema.safeParse({ ...validVideo, liteSortOrder });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === "liteSortOrder")).toBe(true);
    }
  });

  it("allows an unreviewed video when Lite publication is disabled", () => {
    const parsed = videoClientSchema.safeParse({
      ...validVideo,
      safetyStatus: "NEEDS_REVIEW",
      isPublished: false,
      isLitePublished: false,
      liteSortOrder: 0,
    });

    expect(parsed.success).toBe(true);
  });
});
