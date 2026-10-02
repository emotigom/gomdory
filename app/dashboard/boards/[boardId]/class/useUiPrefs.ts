"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_KEYMAP, type NormalizedKeymap } from "./keymap";
import { normalizeKeymap } from "./keymapUtils";

export type ClassUiPrefs = {
  density: "comfortable" | "compact";
  showKeyboardHints: boolean;
  textClampLines: 2 | 3 | 4;
  keymap: NormalizedKeymap;
  classSafeMode: boolean;
};

type UiPrefsNotice = {
  title: string;
  description?: string;
  actionLabel?: string;
};

type UiPrefsResult = {
  prefs: ClassUiPrefs;
  notice: UiPrefsNotice | null;
  updatePrefs: (patch: Partial<ClassUiPrefs>) => void;
  retryRemote: () => void;
};

const DEFAULT_PREFS: ClassUiPrefs = {
  density: "comfortable",
  showKeyboardHints: true,
  textClampLines: 3,
  keymap: DEFAULT_KEYMAP,
  classSafeMode: false,
};

const STORAGE_KEY = "gom:class:ui-prefs";

function safeParsePrefs(raw: string | null): Partial<ClassUiPrefs> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ClassUiPrefs>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function normalizePrefs(input: Partial<ClassUiPrefs>): ClassUiPrefs {
  const density = input.density === "compact" ? "compact" : "comfortable";
  const showKeyboardHints = typeof input.showKeyboardHints === "boolean" ? input.showKeyboardHints : true;
  const textClampLines = input.textClampLines === 2 || input.textClampLines === 4 ? input.textClampLines : 3;
  const keymap = normalizeKeymap(input.keymap ?? null);
  const classSafeMode = typeof input.classSafeMode === "boolean" ? input.classSafeMode : false;

  return {
    density,
    showKeyboardHints,
    textClampLines,
    keymap,
    classSafeMode,
  };
}

function createFallbackNotice(): UiPrefsNotice {
  return {
    title: "네트워크 문제로 로컬 설정만 사용하고 있어요.",
    description: "연결이 복구되면 다시 동기화해 주세요.",
    actionLabel: "다시 시도",
  };
}

export default function useUiPrefs(): UiPrefsResult {
  const [prefs, setPrefs] = useState<ClassUiPrefs>(DEFAULT_PREFS);
  const [notice, setNotice] = useState<UiPrefsNotice | null>(null);
  const [remoteAvailable, setRemoteAvailable] = useState(true);

  const persistPrefs = useCallback((next: ClassUiPrefs) => {
    setPrefs(next);
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const loadRemote = useCallback(async () => {
    try {
      const response = await fetch(apiV1Path("me/ui-prefs"), { method: "GET", cache: "no-store" });
      if (!response.ok) {
        setRemoteAvailable(false);
        setNotice(createFallbackNotice());
        return null;
      }
      const data = (await response.json()) as
        | { ok: true; prefs: Partial<ClassUiPrefs> }
        | { ok: false; code: string; message: string };
      if (!data.ok) {
        setRemoteAvailable(false);
        setNotice(createFallbackNotice());
        return null;
      }
      setRemoteAvailable(true);
      setNotice(null);
      return normalizePrefs({ ...DEFAULT_PREFS, ...data.prefs });
    } catch {
      setRemoteAvailable(false);
      setNotice(createFallbackNotice());
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const cached = normalizePrefs({ ...DEFAULT_PREFS, ...safeParsePrefs(window.localStorage.getItem(STORAGE_KEY)) });
    setPrefs(cached);

    let cancelled = false;
    const run = async () => {
      const remotePrefs = await loadRemote();
      if (cancelled || !remotePrefs) {
        return;
      }
      persistPrefs(remotePrefs);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [loadRemote, persistPrefs]);

  const updatePrefs = useCallback(
    (patch: Partial<ClassUiPrefs>) => {
      setPrefs((current) => {
        const next = normalizePrefs({ ...current, ...patch });
        const previous = current;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        void (async () => {
          if (!remoteAvailable) {
            setNotice(createFallbackNotice());
            persistPrefs(previous);
            return;
          }
          try {
            const response = await fetch(apiV1Path("me/ui-prefs"), {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ class_prefs: next }),
            });
            const data = (await response.json()) as
              | { ok: true; prefs: Partial<ClassUiPrefs> }
              | { ok: false; code: string; message: string };
            if (!response.ok || !data.ok) {
              setRemoteAvailable(false);
              setNotice(createFallbackNotice());
              persistPrefs(previous);
              return;
            }
            setRemoteAvailable(true);
            setNotice(null);
            persistPrefs(normalizePrefs({ ...DEFAULT_PREFS, ...data.prefs }));
          } catch {
            setRemoteAvailable(false);
            setNotice(createFallbackNotice());
            persistPrefs(previous);
          }
        })();
        return next;
      });
    },
    [persistPrefs, remoteAvailable],
  );

  const retryRemote = useCallback(() => {
    setNotice(null);
    void (async () => {
      const remotePrefs = await loadRemote();
      if (remotePrefs) {
        persistPrefs(remotePrefs);
      }
    })();
  }, [loadRemote, persistPrefs]);

  return useMemo(
    () => ({
      prefs,
      notice,
      updatePrefs,
      retryRemote,
    }),
    [notice, prefs, retryRemote, updatePrefs],
  );
}
