"use client";

import { useState, useTransition } from "react";
import { createTagAction, updateTagAction, type ActionResult } from "@/app/admin/actions";

export type ManagedTag = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
};

type TagManagerProps = {
  tags: ManagedTag[];
};

type PendingTagAction =
  | { kind: "create" }
  | { kind: "update"; id: string }
  | null;

export function TagManager({ tags }: TagManagerProps) {
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingTagAction>(null);
  const [isPending, startTransition] = useTransition();

  function submitCreate(formData: FormData) {
    setPendingAction({ kind: "create" });
    startTransition(async () => {
      try {
        setMessage(await createTagAction(formData));
      } finally {
        setPendingAction(null);
      }
    });
  }

  function submitUpdate(tagId: string, formData: FormData) {
    setPendingAction({ kind: "update", id: tagId });
    startTransition(async () => {
      try {
        setMessage(await updateTagAction(tagId, formData));
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="grid gap-6" aria-busy={isPending}>
      {isPending && (
        <p className="sr-only" role="status" aria-live="polite">
          태그 변경을 처리하고 있습니다.
        </p>
      )}
      <form action={submitCreate} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-ink">새 태그</h2>
        <TagFields />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction?.kind === "create" ? "추가 중" : "태그 추가"}
          </button>
        </div>
      </form>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          aria-live={message.ok ? "polite" : "assertive"}
          aria-atomic="true"
          className={`rounded-md border px-4 py-3 text-sm ${
            message.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.message}
        </p>
      )}

      <div className="grid gap-3">
        {tags.map((tag) => (
          <form
            key={tag.id}
            action={(formData) => submitUpdate(tag.id, formData)}
            className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-ink">{tag.name}</p>
                <p className="break-all text-xs text-slate-500">
                  slug: {tag.slug} · 사용 {tag.usageCount}회
                </p>
              </div>
              <span
                className="rounded-md px-2 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${tag.color ?? "#0369a1"}22`,
                  color: "#334155",
                }}
              >
                {tag.isActive ? "활성" : "비활성"}
              </span>
            </div>
            <TagFields tag={tag} />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-ocean hover:text-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingAction?.kind === "update" && pendingAction.id === tag.id
                  ? "저장 중"
                  : "수정 저장"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}

function TagFields({ tag }: { tag?: ManagedTag }) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr_120px_120px_100px]">
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        이름
        <input
          name="name"
          defaultValue={tag?.name ?? ""}
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        색상
        <input
          name="color"
          type="color"
          defaultValue={tag?.color ?? "#0369a1"}
          className="h-11 rounded-md border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        아이콘
        <input
          name="icon"
          defaultValue={tag?.icon ?? ""}
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        정렬
        <input
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={tag?.sortOrder ?? 0}
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-800 md:col-span-3">
        설명
        <input
          name="description"
          defaultValue={tag?.description ?? ""}
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
        <input name="isActive" type="checkbox" defaultChecked={tag?.isActive ?? true} className="accent-ocean" />
        활성
      </label>
    </div>
  );
}
