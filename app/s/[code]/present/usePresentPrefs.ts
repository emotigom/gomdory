"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PresentTheme = "default" | "dark" | "contrast";
export type PresentCardSize = "compact" | "default" | "large";

type PresentPrefs = {
  theme: PresentTheme;
  zoom: number;
  showHints: boolean;
  cardSize: PresentCardSize;
  focusMode: boolean;
  safeMode: boolean;
};

const DEFAULT_PREFS: PresentPrefs = {
  theme: "default",
  zoom: 1,
  showHints: true,
  cardSize: "default",
  focusMode: false,
  safeMode: false,
};

const clampZoom = (value: number) => Math.min(1.4, Math.max(0.85, Number.isFinite(value) ? value : 1));

export function usePresentPrefs(shareCode: string) {
  const storageKey = useMemo(() => `presentPrefs:${shareCode}`, [shareCode]);
  const [prefs, setPrefs] = useState<PresentPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [shouldPersistNext, setShouldPersistNext] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPrefs(DEFAULT_PREFS);
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<PresentPrefs>;
        setPrefs((prev) => ({
          theme: parsed.theme ?? prev.theme,
          zoom: clampZoom(parsed.zoom ?? prev.zoom),
          showHints: parsed.showHints ?? prev.showHints ?? true,
          cardSize: parsed.cardSize ?? prev.cardSize ?? "default",
          focusMode: parsed.focusMode ?? prev.focusMode ?? false,
          safeMode: parsed.safeMode ?? prev.safeMode ?? false,
        }));
      } catch (error) {
        console.warn("Failed to parse present prefs", error);
      }
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded || typeof window === "undefined") return;
    if (!shouldPersistNext) {
      setShouldPersistNext(true);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [loaded, prefs, shouldPersistNext, storageKey]);

  const updatePrefs = useCallback(
    (updater: (prev: PresentPrefs) => PresentPrefs, options?: { persist?: boolean }) => {
      setShouldPersistNext(options?.persist ?? true);
      setPrefs((prev) => updater(prev));
    },
    [],
  );

  const setTheme = useCallback(
    (theme: PresentTheme, options?: { persist?: boolean }) => {
      updatePrefs((prev) => ({ ...prev, theme }), options);
    },
    [updatePrefs],
  );

  const cycleTheme = useCallback(() => {
    updatePrefs((prev) => {
      const order: PresentTheme[] = ["default", "dark", "contrast"];
      const nextIndex = (order.indexOf(prev.theme) + 1) % order.length;
      return { ...prev, theme: order[nextIndex] };
    });
  }, [updatePrefs]);

  const setZoom = useCallback(
    (zoom: number, options?: { persist?: boolean }) => {
      updatePrefs(
        (prev) => ({ ...prev, zoom: clampZoom(Number(zoom.toFixed(2))) }),
        options,
      );
    },
    [updatePrefs],
  );

  const adjustZoom = useCallback((delta: number) => {
    updatePrefs((prev) => ({
      ...prev,
      zoom: clampZoom(Number((prev.zoom + delta).toFixed(2))),
    }));
  }, [updatePrefs]);

  const resetZoom = useCallback(() => {
    updatePrefs((prev) => ({ ...prev, zoom: 1 }));
  }, [updatePrefs]);

  const toggleHints = useCallback(() => {
    updatePrefs((prev) => ({ ...prev, showHints: !prev.showHints }));
  }, [updatePrefs]);

  const setShowHints = useCallback(
    (next: boolean, options?: { persist?: boolean }) => {
      updatePrefs((prev) => ({ ...prev, showHints: next }), options);
    },
    [updatePrefs],
  );

  const setCardSize = useCallback(
    (cardSize: PresentCardSize, options?: { persist?: boolean }) => {
      updatePrefs((prev) => ({ ...prev, cardSize }), options);
    },
    [updatePrefs],
  );

  const toggleFocusMode = useCallback(
    (next?: boolean, options?: { persist?: boolean }) => {
      updatePrefs((prev) => ({ ...prev, focusMode: typeof next === "boolean" ? next : !prev.focusMode }), options);
    },
    [updatePrefs],
  );

  const toggleSafeMode = useCallback(
    (next?: boolean, options?: { persist?: boolean }) => {
      updatePrefs((prev) => ({ ...prev, safeMode: typeof next === "boolean" ? next : !prev.safeMode }), options);
    },
    [updatePrefs],
  );

  const applyProjectorPreset = useCallback(
    (options?: { persist?: boolean; zoomTarget?: number }) => {
      const targetZoom = options?.zoomTarget ?? 1.18;
      const presetZoom = clampZoom(Math.min(1.25, targetZoom));
      updatePrefs(
        (prev) => ({
          ...prev,
          theme: prev.theme === "contrast" ? prev.theme : "contrast",
          zoom: presetZoom,
          showHints: false,
          cardSize: "large",
          focusMode: true,
        }),
        options,
      );
    },
    [updatePrefs],
  );

  return {
    ...prefs,
    setTheme,
    cycleTheme,
    setZoom,
    adjustZoom,
    resetZoom,
    toggleHints,
    setShowHints,
    setCardSize,
    toggleFocusMode,
    toggleSafeMode,
    applyProjectorPreset,
  };
}
