"use client";

import { useEffect, useMemo, useState } from "react";

export type FeedCardSize = "default" | "large";

export function useFeedCardSize(shareCode: string, safeMode: boolean): {
  cardSize: FeedCardSize;
  setCardSize: (size: FeedCardSize) => void;
  sizeHydrated: boolean;
} {
  const storageKey = useMemo(() => `studentFeedCardSize:${shareCode}`, [shareCode]);
  const [cardSize, setCardSizeState] = useState<FeedCardSize>("large");
  const [sizeHydrated, setSizeHydrated] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const parsed = stored === "large" || stored === "default" ? stored : null;
    const fallback = safeMode ? "large" : "default";
    const base = parsed ?? fallback;
    const resolved = safeMode && base === "default" ? "large" : base;
    setCardSizeState(resolved);
    setSizeHydrated(true);
  }, [safeMode, storageKey]);

  useEffect(() => {
    if (!sizeHydrated) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, cardSize);
    }
  }, [cardSize, sizeHydrated, storageKey]);

  const setCardSize = (size: FeedCardSize) => {
    setCardSizeState(size);
  };

  return { cardSize, setCardSize, sizeHydrated };
}
