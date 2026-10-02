"use client";

import { useEffect, useMemo, useState } from "react";

import type { StudentDefaultView } from "@/lib/data/boardShareSettingsShared";

type StudentViewMode = "walls" | "feed";

function parseViewMode(value?: string | null): StudentViewMode | null {
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (lowered === "walls" || lowered === "gallery" || lowered === "columns" || lowered === "grid") {
    return "walls";
  }
  if (lowered === "feed" || lowered === "stream") {
    return "feed";
  }
  return null;
}

function mapDefaultViewToMode(view?: StudentDefaultView | null): StudentViewMode {
  if (view === "stream") return "feed";
  if (view === "gallery" || view === "columns") return "walls";
  return "feed";
}

export function useStudentViewMode(
  shareCode: string,
  initialQueryMode?: string | null,
  serverDefaultView?: StudentDefaultView | null,
): {
  mode: StudentViewMode;
  hydrated: boolean;
  setMode: (mode: StudentViewMode) => void;
  storageKey: string;
} {
  const storageKey = useMemo(() => `studentViewMode:${shareCode}`, [shareCode]);
  const [mode, setMode] = useState<StudentViewMode>("feed");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const preferredMode = parseViewMode(initialQueryMode);
    const storedMode = parseViewMode(window.localStorage.getItem(storageKey));
    const serverMode = mapDefaultViewToMode(serverDefaultView ?? null);
    const nextMode = preferredMode ?? storedMode ?? serverMode ?? "feed";
    setMode(nextMode);
    setHydrated(true);
  }, [initialQueryMode, serverDefaultView, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, mode);
  }, [hydrated, mode, storageKey]);

  return { mode, setMode, hydrated, storageKey };
}

export type { StudentViewMode };
