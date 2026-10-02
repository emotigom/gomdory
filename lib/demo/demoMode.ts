"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export const DEMO_MODE_STORAGE_KEY = "gomdori:demoMode";

export function parseDemoParam(value: string | null | undefined) {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

export function readDemoModeFromStorage(storage?: Storage | null) {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return null;
  try {
    const raw = target.getItem(DEMO_MODE_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeDemoModeToStorage(enabled: boolean, storage?: Storage | null) {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!target) return;
  try {
    target.setItem(DEMO_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

export function useDemoMode(initialOn?: boolean) {
  const searchParams = useSearchParams();
  const forcedByUrl = useMemo(
    () => parseDemoParam(searchParams?.get("demo")),
    [searchParams],
  );
  const [enabled, setEnabled] = useState<boolean>(() => Boolean(initialOn || forcedByUrl));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readDemoModeFromStorage();
    if (stored !== null) {
      setEnabled(stored || forcedByUrl);
    }
    setHydrated(true);
  }, [forcedByUrl]);

  useEffect(() => {
    if (!hydrated) return;
    if (forcedByUrl) {
      setEnabled(true);
      writeDemoModeToStorage(true);
      return;
    }
    writeDemoModeToStorage(enabled);
  }, [enabled, forcedByUrl, hydrated]);

  const toggle = () => setEnabled((prev) => !prev);

  return {
    demoMode: enabled || forcedByUrl,
    setDemoMode: setEnabled,
    toggleDemoMode: toggle,
    forcedByUrl,
  };
}
