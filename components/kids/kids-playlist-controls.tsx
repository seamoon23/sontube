"use client";

import { useEffect, useState } from "react";
import { recordKidsSignalAction } from "@/app/kids/actions";
import { getKidsClientKey } from "@/components/kids/kids-client-key";
import {
  addKidsPlaylistItem,
  KIDS_PLAYLIST_STORAGE_KEY,
  normalizeKidsPlaylist,
  removeKidsPlaylistItem,
  type KidsPlaylistItem,
} from "@/lib/kids-playlist";

export function KidsPlaylistButton({ item }: { item: KidsPlaylistItem }) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(readPlaylist().some((playlistItem) => playlistItem.id === item.id));
  }, [item.id]);

  function toggle() {
    const current = readPlaylist();
    const nextSaved = !isSaved;
    const next = isSaved ? removeKidsPlaylistItem(current, item.id) : addKidsPlaylistItem(current, item);
    writePlaylist(next);
    setIsSaved(nextSaved);
    window.dispatchEvent(new CustomEvent("sontube-playlist-updated"));
    void recordKidsSignalAction({
      videoId: item.id,
      clientKey: getKidsClientKey(),
      type: "PLAYLIST",
      active: nextSaved,
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isSaved}
      aria-label={`${item.title} ${isSaved ? "내 목록에서 빼기" : "내 목록에 담기"}`}
      className={`min-h-11 rounded-md px-3 py-2 text-sm font-bold transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none ${
        isSaved ? "bg-coral text-white" : "border border-slate-300 bg-white text-slate-700 hover:border-coral"
      }`}
    >
      {isSaved ? "담김" : "내 목록"}
    </button>
  );
}

export function KidsPlaylistPanel() {
  const [items, setItems] = useState<KidsPlaylistItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(readPlaylist());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("sontube-playlist-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sontube-playlist-updated", refresh);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto grid max-w-6xl gap-3 px-4 pt-5 md:px-8" aria-labelledby="kids-playlist-title">
      <div className="flex items-center justify-between">
        <h2 id="kids-playlist-title" className="text-lg font-black text-ink">내 목록</h2>
        <span className="text-xs font-semibold text-slate-500">{items.length}개</span>
      </div>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <li key={item.id} className="w-44 shrink-0 snap-start">
            <a
              href={`/kids/watch/${item.id}`}
              aria-label={`${item.title} 보기`}
              className="grid h-full gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition hover:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" className="aspect-video w-full rounded-md bg-slate-100 object-cover" />
              <span className="line-clamp-2 break-words text-sm font-bold text-ink">{item.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function readPlaylist(): KidsPlaylistItem[] {
  try {
    return normalizeKidsPlaylist(JSON.parse(window.localStorage.getItem(KIDS_PLAYLIST_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writePlaylist(items: KidsPlaylistItem[]) {
  window.localStorage.setItem(KIDS_PLAYLIST_STORAGE_KEY, JSON.stringify(items));
}
