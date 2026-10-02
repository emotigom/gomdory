"use client";

const EDU_NICKNAME_STORAGE_KEY = "edu:v1:nickname";

export function getLocalEduNickname(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const stored = window.localStorage.getItem(EDU_NICKNAME_STORAGE_KEY);
  return stored?.trim() ?? "";
}

export function setLocalEduNickname(name: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }

  try {
    window.localStorage.setItem(EDU_NICKNAME_STORAGE_KEY, trimmed);
  } catch {
    // Ignore write failures
  }
}

export function resolveEduNickname(joinNickname: string | null | undefined, localNickname: string, fallback: string) {
  const candidates = [joinNickname, localNickname, fallback];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }

  return fallback;
}
