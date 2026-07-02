import { buildYouTubeThumbnailUrl } from "@/lib/youtube";

export const PLACEHOLDER_THUMBNAIL = "/thumbnail-placeholder.svg";

export type ThumbnailSource = {
  youtubeVideoId: string;
  thumbnailType: "YOUTUBE" | "CUSTOM" | "PLACEHOLDER";
  youtubeThumbnailUrl: string | null;
  customThumbnailPath: string | null;
};

export function getThumbnailUrl(video: ThumbnailSource): string {
  if (video.thumbnailType === "CUSTOM" && video.customThumbnailPath) {
    return video.customThumbnailPath;
  }

  if (video.thumbnailType === "YOUTUBE") {
    return video.youtubeThumbnailUrl ?? buildYouTubeThumbnailUrl(video.youtubeVideoId);
  }

  return PLACEHOLDER_THUMBNAIL;
}
