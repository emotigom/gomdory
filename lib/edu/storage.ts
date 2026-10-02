"use client";

type EduProfile = {
  code: string;
  name: string;
};

type EduProgress = {
  completedLessons: number[];
};

const CURRENT_PROFILE_KEY = "edu:v1:current-profile";
const profileKey = (code: string) => `edu:v1:${code}:profile`;
const progressKey = (code: string) => `edu:v1:${code}:progress`;
const boardKey = (code: string) => `edu:v1:${code}:board-id`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getEduProfile(): EduProfile {
  if (typeof window === "undefined") {
    return { code: "", name: "" };
  }

  const parsed = safeParse<EduProfile>(window.localStorage.getItem(CURRENT_PROFILE_KEY), {
    code: "",
    name: "",
  });

  return {
    code: typeof parsed.code === "string" ? parsed.code : "",
    name: typeof parsed.name === "string" ? parsed.name : "",
  };
}

export function setEduProfile(next: EduProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    code: next.code,
    name: next.name,
  };

  try {
    window.localStorage.setItem(CURRENT_PROFILE_KEY, JSON.stringify(payload));
    if (next.code) {
      window.localStorage.setItem(profileKey(next.code), JSON.stringify(payload));
    }
  } catch {
    // Ignore write failures (private mode, storage quota, etc.)
  }
}

export function getEduProgress(code: string): EduProgress {
  if (typeof window === "undefined" || !code) {
    return { completedLessons: [] };
  }

  const parsed = safeParse<EduProgress>(window.localStorage.getItem(progressKey(code)), {
    completedLessons: [],
  });

  const cleaned = Array.isArray(parsed.completedLessons)
    ? parsed.completedLessons.filter((lesson) => Number.isInteger(lesson))
    : [];

  return {
    completedLessons: cleaned,
  };
}

export function setEduProgress(code: string, next: EduProgress): void {
  if (typeof window === "undefined" || !code) {
    return;
  }

  const payload = {
    completedLessons: Array.isArray(next.completedLessons) ? next.completedLessons : [],
  };

  try {
    window.localStorage.setItem(progressKey(code), JSON.stringify(payload));
  } catch {
    // Ignore write failures
  }
}

export function getEduBoardId(code: string): string | null {
  if (typeof window === "undefined" || !code) {
    return null;
  }

  const stored = window.localStorage.getItem(boardKey(code));
  const trimmed = stored?.trim() ?? "";
  return trimmed || null;
}

export function setEduBoardId(code: string, boardId: string | null | undefined): void {
  if (typeof window === "undefined" || !code) {
    return;
  }

  const trimmed = boardId?.trim();
  if (!trimmed) {
    return;
  }

  try {
    window.localStorage.setItem(boardKey(code), trimmed);
  } catch {
    // Ignore write failures
  }
}
