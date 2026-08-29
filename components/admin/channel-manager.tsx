"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  mergeChannelAction,
  renameChannelAction,
  toggleChannelActiveAction,
  type ChannelActionResult,
} from "@/app/admin/channels/actions";
import { MAX_CHANNEL_DISPLAY_NAME_LENGTH } from "@/lib/channels";

export type ChannelManagerItem = {
  id: string;
  displayName: string;
  isActive: boolean;
  videoCount: number;
  approvedVideoCount: number;
};

export function ChannelManager({ channels }: { channels: ChannelManagerItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<Record<string, ChannelActionResult>>({});
  const [globalResult, setGlobalResult] = useState<ChannelActionResult | null>(null);

  function run(channelId: string, operation: () => Promise<ChannelActionResult>) {
    setGlobalResult(null);
    setResults((current) => {
      const next = { ...current };
      delete next[channelId];
      return next;
    });
    startTransition(async () => {
      const result = await operation();
      setResults((current) => ({ ...current, [channelId]: result }));
      if (result.ok) router.refresh();
    });
  }

  function runMerge(sourceChannelId: string, formData: FormData) {
    setGlobalResult(null);
    startTransition(async () => {
      const result = await mergeChannelAction(sourceChannelId, formData);
      setGlobalResult(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="grid gap-4">
      {globalResult && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            globalResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {globalResult.message}
        </p>
      )}
      {channels.map((channel) => {
        const mergeTargets = channels.filter(
          (candidate) => candidate.id !== channel.id && candidate.isActive,
        );
        const result = results[channel.id];

        return (
          <article
            key={channel.id}
            className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-lg font-bold text-ink">{channel.displayName}</h3>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      channel.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {channel.isActive ? "사용 중" : "사용 중지"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  등록 {channel.videoCount}편 · 아이에게 공개된 승인 영상 {channel.approvedVideoCount}편
                </p>
              </div>
              <Link
                href={`/admin/videos?channel=${encodeURIComponent(channel.id)}`}
                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean"
              >
                이 채널 영상 보기
              </Link>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  run(channel.id, () => renameChannelAction(channel.id, formData));
                }}
                className="grid gap-2 rounded-md bg-slate-50 p-3"
              >
                <label htmlFor={`channel-name-${channel.id}`} className="text-sm font-semibold text-slate-700">
                  채널명 변경
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id={`channel-name-${channel.id}`}
                    name="displayName"
                    defaultValue={channel.displayName}
                    maxLength={MAX_CHANNEL_DISPLAY_NAME_LENGTH}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean disabled:opacity-50"
                  >
                    이름 저장
                  </button>
                </div>
              </form>

              <div className="grid gap-2 rounded-md bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-700">새 영상 선택 여부</p>
                <p className="text-xs leading-5 text-slate-500">
                  사용 중지해도 기존 영상의 채널 표시와 같은 채널 목록은 유지됩니다.
                </p>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(channel.id, () => toggleChannelActiveAction(channel.id))}
                  className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-ocean hover:text-ocean disabled:opacity-50"
                >
                  {channel.isActive ? "새 영상 선택에서 숨기기" : "다시 사용하기"}
                </button>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const targetName =
                  mergeTargets.find(
                    (candidate) => candidate.id === String(formData.get("targetChannelId")),
                  )?.displayName ?? "선택한 채널";
                if (
                  !window.confirm(
                    `"${channel.displayName}"의 모든 영상을 "${targetName}"으로 옮기고 현재 채널을 삭제할까요?`,
                  )
                ) {
                  return;
                }
                runMerge(channel.id, formData);
              }}
              className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 md:grid-cols-[1fr_auto] md:items-end"
            >
              <label className="grid gap-1 text-sm font-semibold text-amber-900">
                중복 채널 병합
                <select
                  name="targetChannelId"
                  defaultValue=""
                  disabled={mergeTargets.length === 0 || isPending}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">영상을 옮길 채널 선택</option>
                  {mergeTargets.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.displayName}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal leading-5 text-amber-800">
                  연결 영상을 대상 채널로 옮긴 뒤 현재 중복 채널을 삭제합니다.
                </span>
              </label>
              <button
                type="submit"
                disabled={mergeTargets.length === 0 || isPending}
                className="rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 채널로 병합
              </button>
            </form>

            {result && (
              <p
                role="status"
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                }`}
              >
                {result.message}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}