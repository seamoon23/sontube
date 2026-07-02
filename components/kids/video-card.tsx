import Link from "next/link";
import { getThumbnailUrl, type ThumbnailSource } from "@/lib/thumbnails";

export type KidsVideoCardData = ThumbnailSource & {
  id: string;
  title: string;
  durationText: string | null;
  tags: {
    tag: {
      id: string;
      name: string;
      color: string | null;
    };
  }[];
};

export function KidsVideoCard({ video }: { video: KidsVideoCardData }) {
  return (
    <Link
      href={`/kids/watch/${video.id}`}
      className="group grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="overflow-hidden rounded-md bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getThumbnailUrl(video)}
          alt=""
          className="aspect-video w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="grid gap-2">
        <h2 className="line-clamp-2 text-base font-bold leading-snug text-ink">{video.title}</h2>
        <div className="flex flex-wrap gap-1.5">
          {video.tags.slice(0, 3).map(({ tag }) => (
            <span
              key={tag.id}
              className="rounded-md px-2 py-1 text-xs font-semibold"
              style={{ backgroundColor: `${tag.color ?? "#0369a1"}22`, color: tag.color ?? "#0369a1" }}
            >
              {tag.name}
            </span>
          ))}
          {video.durationText && (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {video.durationText}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
