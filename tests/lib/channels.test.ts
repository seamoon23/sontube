import { describe, expect, it } from "vitest";
import {
  cleanChannelDisplayName,
  MAX_CHANNEL_DISPLAY_NAME_LENGTH,
  normalizeChannelName,
} from "@/lib/channels";

describe("cleanChannelDisplayName", () => {
  it("normalizes compatibility characters and whitespace for display", () => {
    expect(cleanChannelDisplayName("  Ｓｏｎ　\t Tube \n Kids  ")).toBe("Son Tube Kids");
  });

  it("removes zero-width formatting characters", () => {
    expect(cleanChannelDisplayName("Son\u200b\u200c\u200d\u2060\ufeffTube")).toBe("SonTube");
    expect(cleanChannelDisplayName("A\u180e B")).toBe("A B");
  });

  it("is idempotent and preserves visible non-Latin characters", () => {
    const cleaned = cleanChannelDisplayName("  핑크퐁   동물동요  ");

    expect(cleaned).toBe("핑크퐁 동물동요");
    expect(cleanChannelDisplayName(cleaned)).toBe(cleaned);
  });

  it("publishes the shared form length limit", () => {
    expect(MAX_CHANNEL_DISPLAY_NAME_LENGTH).toBe(80);
  });
});

describe("normalizeChannelName", () => {
  it("builds the same case-insensitive key for equivalent names", () => {
    expect(normalizeChannelName("  SON\u200bTUBE  KIDS ")).toBe("sontube kids");
    expect(normalizeChannelName("sontube   kids")).toBe("sontube kids");
  });

  it("applies NFKC before case folding", () => {
    expect(normalizeChannelName("ＰｉｎｋＦＯＮＧ")).toBe("pinkfong");
  });
});
