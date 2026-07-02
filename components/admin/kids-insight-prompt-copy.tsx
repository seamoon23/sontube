"use client";

import { useState } from "react";

export function KidsInsightPromptCopy({ prompt }: { prompt: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">AI에 붙여넣을 요약 프롬프트</h3>
        <button
          type="button"
          onClick={copyPrompt}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {status === "copied" ? "복사됨" : status === "failed" ? "직접 선택" : "복사"}
        </button>
      </div>
      <textarea
        readOnly
        value={prompt}
        className="min-h-80 w-full rounded-md border border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
      />
    </div>
  );
}
