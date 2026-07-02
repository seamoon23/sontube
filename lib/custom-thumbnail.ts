export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
export const SUPPORTED_THUMBNAIL_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type ThumbnailValidationResult =
  | {
      ok: true;
      extension: string;
    }
  | {
      ok: false;
      message: string;
    };

export function validateCustomThumbnailFile(file: File): ThumbnailValidationResult {
  if (file.size > MAX_THUMBNAIL_BYTES) {
    return {
      ok: false,
      message: "커스텀 썸네일은 2MB 이하 이미지만 업로드할 수 있습니다.",
    };
  }

  const extension = SUPPORTED_THUMBNAIL_TYPES.get(file.type);
  if (!extension) {
    return {
      ok: false,
      message: "커스텀 썸네일은 JPG, PNG, WEBP 형식만 지원합니다.",
    };
  }

  return {
    ok: true,
    extension,
  };
}
