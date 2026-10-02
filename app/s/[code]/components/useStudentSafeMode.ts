"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "studentSafeMode";

export function useStudentSafeMode() {
  const searchParams = useSearchParams();
  const safeParam = searchParams.get("safe");
  const [safeMode, setSafeMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const derivedFromQuery = useMemo(() => safeParam === "1" || safeParam === "true", [safeParam]);

  useEffect(() => {
    const persisted = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
    const next = derivedFromQuery || persisted;
    setSafeMode(next);
    setHydrated(true);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.studentSafeMode = next ? "true" : "false";
    }

    if (derivedFromQuery && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  }, [derivedFromQuery]);

  const toggleSafeMode = useCallback((next?: boolean) => {
    setSafeMode((prev) => {
      const resolved = typeof next === "boolean" ? next : !prev;
      if (typeof document !== "undefined") {
        document.documentElement.dataset.studentSafeMode = resolved ? "true" : "false";
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, resolved ? "1" : "0");
      }
      return resolved;
    });
  }, []);

  return { safeMode, safeHydrated: hydrated, toggleSafeMode };
}
