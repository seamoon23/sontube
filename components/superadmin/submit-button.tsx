"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  className?: string;
};

const toneClasses = {
  primary: "border-teal-800 bg-teal-800 text-white hover:bg-teal-900",
  secondary: "border-slate-300 bg-white text-slate-800 hover:border-teal-600 hover:text-teal-800",
  danger: "border-red-300 bg-white text-red-700 hover:bg-red-50",
};

export function SubmitButton({
  label,
  pendingLabel = "처리 중",
  tone = "primary",
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses[tone]} ${className}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
