"use client";

import { useState } from "react";
import { recordKidsSignalAction } from "@/app/kids/actions";
import { getKidsClientKey } from "@/components/kids/kids-client-key";
import { KIDS_SIGNAL_OPTIONS, type KidsFeedbackSignalType } from "@/lib/kids-signals";

const toneClassNames = {
  positive: "border-green-200 bg-green-50 text-green-800 hover:border-green-400",
  curious: "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-400",
  soft: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400",
  hard: "border-slate-300 bg-white text-slate-700 hover:border-slate-500",
};

export function KidsFeedbackButtons({ videoId }: { videoId: string }) {
  const [selected, setSelected] = useState<KidsFeedbackSignalType | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function choose(type: KidsFeedbackSignalType) {
    setSelected(type);
    setMessage("고마워!");
    setIsSaving(true);

    void recordKidsSignalAction({
      videoId,
      clientKey: getKidsClientKey(),
      type,
      active: true,
    })
      .then((result) => {
        if (!result.ok) {
          setMessage(result.message);
        }
      })
      .finally(() => setIsSaving(false));
  }

  return (
    <section className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4" aria-labelledby="kids-feedback-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="kids-feedback-title" className="text-lg font-black text-white">어땠어?</h2>
        <span className="min-h-5 text-sm font-semibold text-sky-100" role="status" aria-live="polite" aria-atomic="true">
          {isSaving ? "저장 중" : message}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {KIDS_SIGNAL_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => choose(option.type)}
            aria-pressed={selected === option.type}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink motion-reduce:transform-none motion-reduce:transition-none ${
              selected === option.type ? "border-white bg-white text-ink" : toneClassNames[option.tone]
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
