"use client";

const KIDS_CLIENT_KEY_STORAGE_KEY = "sontube:kids-client-key";

export function getKidsClientKey(): string {
  const existing = window.localStorage.getItem(KIDS_CLIENT_KEY_STORAGE_KEY);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `kids-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(KIDS_CLIENT_KEY_STORAGE_KEY, next);
  return next;
}
