import { SafetyStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildKidsVideoWhere } from "@/lib/kids-query";

describe("buildKidsVideoWhere", () => {
  it("always restricts kids videos to parent-checked and published records", () => {
    expect(buildKidsVideoWhere({})).toEqual({
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
    });
  });

  it("searches only parent-authored title and keyword fields on the kids screen", () => {
    expect(buildKidsVideoWhere({ q: "cat" })).toEqual({
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
      OR: [{ title: { contains: "cat" } }, { searchKeywords: { contains: "cat" } }],
    });
  });

  it("adds active tag filtering without loosening visibility rules", () => {
    expect(buildKidsVideoWhere({ q: "cat", tagSlug: "animals" })).toEqual({
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
      OR: [{ title: { contains: "cat" } }, { searchKeywords: { contains: "cat" } }],
      tags: {
        some: {
          tag: {
            slug: "animals",
            isActive: true,
          },
        },
      },
    });
  });

  it("builds a parent-recommended query without user search filters", () => {
    expect(buildKidsVideoWhere({ parentRecommendedOnly: true })).toEqual({
      isPublished: true,
      safetyStatus: SafetyStatus.PARENT_CHECKED,
      isParentRecommended: true,
    });
  });
});
