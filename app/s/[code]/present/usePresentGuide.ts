"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/ui/motion";

type GuideOptions = {
  openDelayMs?: number;
  autoCloseMs?: number;
};

export function usePresentGuide(shareCode: string, options?: GuideOptions) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const storageKey = useMemo(() => `presentGuideDismissed:${shareCode}`, [shareCode]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const delayRef = useRef<number | null>(null);
  const autoCloseRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "1");
    }
  }, [storageKey]);

  const reopen = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "1") {
      setDismissed(true);
      return;
    }
    const delay = typeof options?.openDelayMs === "number" ? options.openDelayMs : 800;
    delayRef.current = window.setTimeout(() => setOpen(true), delay);
    return () => {
      if (delayRef.current) {
        window.clearTimeout(delayRef.current);
        delayRef.current = null;
      }
    };
  }, [options?.openDelayMs, storageKey]);

  useEffect(() => {
    if (!open) return;
    const autoClose = options?.autoCloseMs ?? (prefersReducedMotion ? 8000 : 10_000);
    autoCloseRef.current = window.setTimeout(() => dismiss(), autoClose);
    return () => {
      if (autoCloseRef.current) {
        window.clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    };
  }, [dismiss, open, options?.autoCloseMs, prefersReducedMotion]);

  return { open, dismissed, dismiss, reopen, storageKey };
}
