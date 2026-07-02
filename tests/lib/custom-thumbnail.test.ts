import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveManagedCustomThumbnailPath, validateCustomThumbnailFile } from "@/lib/custom-thumbnail";

describe("validateCustomThumbnailFile", () => {
  it("accepts supported image files under the size limit", () => {
    const file = new File(["image"], "thumb.png", { type: "image/png" });

    expect(validateCustomThumbnailFile(file)).toEqual({
      ok: true,
      extension: "png",
    });
  });

  it("rejects unsupported file types with a user-facing message", () => {
    const file = new File(["nope"], "thumb.gif", { type: "image/gif" });

    expect(validateCustomThumbnailFile(file)).toEqual({
      ok: false,
      message: "커스텀 썸네일은 JPG, PNG, WEBP 형식만 지원합니다.",
    });
  });

  it("rejects images larger than 2MB with a user-facing message", () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "thumb.png", {
      type: "image/png",
    });

    expect(validateCustomThumbnailFile(file)).toEqual({
      ok: false,
      message: "커스텀 썸네일은 2MB 이하 이미지만 업로드할 수 있습니다.",
    });
  });
});

describe("resolveManagedCustomThumbnailPath", () => {
  it("resolves app-managed uploaded thumbnails under the public uploads folder", () => {
    const root = path.resolve("/app");

    expect(resolveManagedCustomThumbnailPath("/uploads/thumbnails/abc.png", root)).toBe(
      path.join(root, "public", "uploads", "thumbnails", "abc.png"),
    );
  });

  it("rejects paths outside the managed thumbnail directory", () => {
    expect(resolveManagedCustomThumbnailPath("/thumbnail-placeholder.svg", "/app")).toBeNull();
    expect(resolveManagedCustomThumbnailPath("https://img.youtube.com/vi/demo/hqdefault.jpg", "/app")).toBeNull();
    expect(resolveManagedCustomThumbnailPath("/uploads/thumbnails/../secret.txt", "/app")).toBeNull();
  });
});
