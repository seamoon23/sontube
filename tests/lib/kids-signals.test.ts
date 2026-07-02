import { describe, expect, it } from "vitest";
import {
  KIDS_SIGNAL_OPTIONS,
  getKidsSignalLabel,
  isKidsFeedbackSignal,
  isKidsSignalType,
} from "@/lib/kids-signals";

describe("kids signal options", () => {
  it("keeps feedback buttons short and kid-friendly", () => {
    expect(KIDS_SIGNAL_OPTIONS.map((option) => option.label)).toEqual([
      "좋아요",
      "다시 볼래요",
      "궁금해요",
      "웃겨요",
      "어려워요",
      "별로예요",
    ]);
  });

  it("recognizes supported signal types and separates playlist from feedback", () => {
    expect(isKidsSignalType("LIKE")).toBe(true);
    expect(isKidsSignalType("PLAYLIST")).toBe(true);
    expect(isKidsSignalType("UNKNOWN")).toBe(false);
    expect(isKidsFeedbackSignal("LIKE")).toBe(true);
    expect(isKidsFeedbackSignal("PLAYLIST")).toBe(false);
  });

  it("returns labels for parent insight summaries", () => {
    expect(getKidsSignalLabel("CURIOUS")).toBe("궁금해요");
    expect(getKidsSignalLabel("PLAYLIST")).toBe("내 목록 담기");
  });
});
