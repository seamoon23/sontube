"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAppAccessKeyAction,
  disableAppAccessKeyAction,
  type AppKeyActionResult,
} from "@/app/admin/app-keys/actions";

export type ManagedAppAccessKey = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  status: "disabled" | "trial" | "paid" | "expired";
  statusLabel: string;
  canSync: boolean;
  trialStartedAt: string;
  trialEndsAt: string;
  paidUntil: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
};

type PendingAppKeyAction =
  | { kind: "create" }
  | { kind: "disable"; id: string }
  | null;

export function AppKeyManager({ keys }: { keys: ManagedAppAccessKey[] }) {
  const router = useRouter();
  const [result, setResult] = useState<AppKeyActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAppKeyAction>(null);
  const [isPending, startTransition] = useTransition();

  function submitCreate(formData: FormData) {
    setCopied(false);
    setPendingAction({ kind: "create" });
    startTransition(async () => {
      try {
        const next = await createAppAccessKeyAction(formData);
        setResult(next);
        if (next.ok) router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function submitDisable(id: string) {
    setPendingAction({ kind: "disable", id });
    startTransition(async () => {
      try {
        const next = await disableAppAccessKeyAction(id);
        setResult(next);
        if (next.ok) router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  async function copyCreatedKey() {
    if (!result?.createdKey) return;
    await navigator.clipboard.writeText(result.createdKey);
    setCopied(true);
  }

  return (
    <div className="grid gap-6" aria-busy={isPending}>
      {isPending && (
        <p className="sr-only" role="status" aria-live="polite">
          앱 키 요청을 처리하고 있습니다.
        </p>
      )}
      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-ocean">앱 연결</p>
          <h2 className="text-xl font-bold text-ink">가족 앱 키 만들기</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이 키를 앱 설정에 등록하면 승인된 영상 카탈로그가 앱으로 동기화됩니다. 무료 체험은 키 생성 시점부터 14일입니다.
          </p>
        </div>
        <form action={submitCreate} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            키 이름
            <input
              name="name"
              placeholder="예: 거실 태블릿, 아들 폰"
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ocean focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 self-end rounded-md bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction?.kind === "create" ? "생성 중" : "앱 키 생성"}
          </button>
        </form>
      </section>

      {result && (
        <section
          role={result.ok ? "status" : "alert"}
          aria-live={result.ok ? "polite" : "assertive"}
          aria-atomic="true"
          className={`grid gap-3 rounded-lg border p-4 text-sm ${
            result.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-semibold">{result.message}</p>
          {result.createdKey && (
            <div className="grid gap-2">
              <label className="grid gap-1 font-semibold">
                앱에 등록할 키
                <input
                  readOnly
                  value={result.createdKey}
                  className="min-h-11 rounded-md border border-green-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyCreatedKey}
                  className="min-h-11 rounded-md border border-green-300 bg-white px-3 py-2 text-xs font-bold text-green-900 hover:border-green-500"
                >
                  복사
                </button>
                <span className="text-xs text-green-800" aria-live="polite" aria-atomic="true">
                  {copied ? "복사했습니다." : "보안을 위해 원문 키는 다시 조회되지 않습니다."}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ocean">등록된 앱</p>
            <h2 className="text-xl font-bold text-ink">앱 키 조회</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">{keys.length}개</p>
        </div>

        {keys.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            아직 만든 앱 키가 없습니다.
          </div>
        )}

        {keys.map((key) => (
          <article key={key.id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-lg font-bold text-ink">{key.name}</h3>
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${getStatusClassName(key.status)}`}>
                  {key.statusLabel}
                </span>
              </div>
              <p className="break-all font-mono text-xs text-slate-500">prefix: {key.keyPrefix}...</p>
              <dl className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <Info label="체험 종료" value={formatDate(key.trialEndsAt)} />
                <Info label="유료 이용" value={key.paidUntil ? formatDate(key.paidUntil) : "미적용"} />
                <Info label="최근 동기화" value={key.lastSyncedAt ? formatDateTime(key.lastSyncedAt) : "아직 없음"} />
              </dl>
            </div>
            <div className="flex items-start justify-end">
              <button
                type="button"
                disabled={isPending || !key.isActive}
                onClick={() => submitDisable(key.id)}
                aria-label={`${key.name} 앱 키 ${
                  pendingAction?.kind === "disable" && pendingAction.id === key.id
                    ? "비활성화 중"
                    : "비활성화"
                }`}
                className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingAction?.kind === "disable" && pendingAction.id === key.id
                  ? "비활성화 중"
                  : "비활성화"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function getStatusClassName(status: ManagedAppAccessKey["status"]): string {
  switch (status) {
    case "disabled":
      return "bg-slate-100 text-slate-600";
    case "trial":
      return "bg-sky-100 text-sky-800";
    case "paid":
      return "bg-green-100 text-green-800";
    case "expired":
      return "bg-amber-100 text-amber-800";
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
