"use client";

import { useEffect, useState } from "react";
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
    const next = isSaved ? removeKidsPlaylistItem(current, item.id) : addKidsPlaylistItem(current, item);
    writePlaylist(next);
    setIsSaved(!isSaved);
    window.dispatchEvent(new CustomEvent("sontube-playlist-updated"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md px-3 py-2 text-sm font-bold transition ${
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
    <section className="mx-auto grid max-w-6xl gap-3 px-4 pt-5 md:px-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-ink">내 목록</h2>
        <span className="text-xs font-semibold text-slate-500">{items.length}개</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={`/kids/watch/${item.id}`}
            className="grid w-44 shrink-0 gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnailUrl} alt="" className="aspect-video w-full rounded-md object-cover" />
            <span className="line-clamp-2 text-sm font-bold text-ink">{item.title}</span>
          </a>
        ))}
      </div>
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
