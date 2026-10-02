"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type DashboardMode = "clean" | "manage" | "focus";

const STORAGE_KEY = "dashboard_mode";
const MODE_VALUES: DashboardMode[] = ["clean", "manage", "focus"];

function parseMode(value: string | null | undefined): DashboardMode | null {
  if (!value) return null;
  return MODE_VALUES.includes(value as DashboardMode) ? (value as DashboardMode) : null;
}

function readStoredMode(): DashboardMode | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return parseMode(raw);
}

export default function useDashboardMode(initialCleanView = false) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlMode = parseMode(searchParams?.get("mode"));

  const [mode, setMode] = useState<DashboardMode>(() => {
    if (urlMode) return urlMode;
    const stored = readStoredMode();
    if (stored) return stored;
    return initialCleanView ? "clean" : "clean";
  });

  useEffect(() => {
    if (!urlMode) return;
    setMode((current) => (current === urlMode ? current : urlMode));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, urlMode);
    }
  }, [urlMode]);

  const updateMode = useCallback(
    (nextMode: DashboardMode) => {
      setMode(nextMode);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, nextMode);
      }

      const params = new URLSearchParams(searchParams?.toString());
      params.set("mode", nextMode);
      params.delete("clean");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return useMemo(
    () => ({
      mode,
      setMode: updateMode,
    }),
    [mode, updateMode],
  );
}
