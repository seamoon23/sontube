import Link from "next/link";
import { getThumbnailUrl, type ThumbnailSource } from "@/lib/thumbnails";
import { KidsPlaylistButton } from "@/components/kids/kids-playlist-controls";

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
  const thumbnailUrl = getThumbnailUrl(video);

  return (
    <article className="group grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft motion-reduce:transform-none motion-reduce:transition-none">
      <Link
        href={`/kids/watch/${video.id}`}
        aria-label={`${video.title} 보기`}
        className="grid gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2"
      >
        <div className="overflow-hidden rounded-md bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-video w-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
          />
        </div>
        <h3 className="line-clamp-2 break-words text-base font-bold leading-snug text-ink">{video.title}</h3>
      </Link>
      <div className="flex flex-wrap gap-1.5">
        {video.tags.slice(0, 3).map(({ tag }) => (
          <span
            key={tag.id}
            className="rounded-md px-2 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${tag.color ?? "#0369a1"}22`, color: "#334155" }}
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
      <KidsPlaylistButton
        item={{
          id: video.id,
          title: video.title,
          thumbnailUrl,
          durationText: video.durationText,
        }}
      />
    </article>
  );
}
