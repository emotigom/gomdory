"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getModeDefaults, type ClassMode, type ClassModeDefaults } from "./classModes";

const buildStorageKey = (boardId: string) => `classMode:${boardId}`;

function safeParseMode(value: string | null): ClassMode | null {
  if (value === "collect" || value === "organize" || value === "present") {
    return value;
  }
  return null;
}

export default function useClassMode(boardId: string, initial: ClassMode = "collect") {
  const [mode, setMode] = useState<ClassMode>(initial);
  const [isReady, setIsReady] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) {
      return;
    }
    hasHydrated.current = true;
    if (typeof window === "undefined") {
      setIsReady(true);
      return;
    }
    const stored = safeParseMode(window.localStorage.getItem(buildStorageKey(boardId)));
    if (stored) {
      setMode(stored);
    }
    setIsReady(true);
  }, [boardId]);

  const applyMode = useCallback(
    (nextMode: ClassMode): ClassModeDefaults => {
      setMode(nextMode);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(buildStorageKey(boardId), nextMode);
      }
      return getModeDefaults(nextMode);
    },
    [boardId],
  );

  return { mode, setMode: applyMode, isReady } as const;
}
