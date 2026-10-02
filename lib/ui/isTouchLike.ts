"use client";

import { useEffect, useState } from "react";

const COMPACT_WIDTH = 900;

export function isTouchLike(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0;
  return coarsePointer || touchPoints > 0;
}

export function useTouchLike(): { touchLike: boolean; compact: boolean } {
  const [touchLike, setTouchLike] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateState = () => {
      setTouchLike(isTouchLike());
      setCompact(window.innerWidth < COMPACT_WIDTH);
    };

    const media = window.matchMedia?.("(pointer: coarse)");
    const handleMediaChange = () => updateState();

    updateState();

    media?.addEventListener("change", handleMediaChange);
    window.addEventListener("resize", updateState, { passive: true });

    return () => {
      media?.removeEventListener("change", handleMediaChange);
      window.removeEventListener("resize", updateState);
    };
  }, []);

  return { touchLike, compact };
}
