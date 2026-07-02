import { describe, expect, it } from "vitest";
import {
  addKidsPlaylistItem,
  normalizeKidsPlaylist,
  removeKidsPlaylistItem,
  type KidsPlaylistItem,
} from "@/lib/kids-playlist";

const itemA: KidsPlaylistItem = {
  id: "video-a",
  title: "동물 친구들",
  thumbnailUrl: "/a.jpg",
  durationText: "03:00",
};

const itemB: KidsPlaylistItem = {
  id: "video-b",
  title: "과학 놀이",
  thumbnailUrl: "/b.jpg",
  durationText: null,
};

describe("kids playlist helpers", () => {
  it("adds approved video items without duplicating the same video", () => {
    expect(addKidsPlaylistItem([itemA], itemA)).toEqual([itemA]);
    expect(addKidsPlaylistItem([itemA], itemB)).toEqual([itemA, itemB]);
  });

  it("removes items by video id", () => {
    expect(removeKidsPlaylistItem([itemA, itemB], "video-a")).toEqual([itemB]);
  });

  it("normalizes unknown local storage data into safe playlist items", () => {
    expect(
      normalizeKidsPlaylist([
        itemA,
        { id: "broken", title: "", thumbnailUrl: "/x.jpg", durationText: null },
        { id: "video-c", title: "영어", thumbnailUrl: "/c.jpg" },
      ]),
    ).toEqual([
      itemA,
      { id: "video-c", title: "영어", thumbnailUrl: "/c.jpg", durationText: null },
    ]);
  });
});
