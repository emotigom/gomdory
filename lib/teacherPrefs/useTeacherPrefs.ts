"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { createRequestId, setLastRequestId as setGlobalRequestId } from "@/lib/http/requestId";
import { ENABLE_TEACHER_PREFS_SERVER_SYNC } from "@/lib/standards/flags";
import { fetchWithTimeout } from "@/lib/standards/fetchWithTimeout";
import { routes } from "@/lib/standards/routes";
import {
  DEFAULT_TEACHER_UI_PREFS,
  TEACHER_UI_PREFS_STORAGE_KEY,
  type TeacherUiPrefs,
  mergeTeacherUiPrefs,
  normalizeTeacherUiPrefs,
  normalizeTeacherUiPrefsPatch,
} from "./schema";

const SHADOW_TOKENS: Record<TeacherUiPrefs["dashboardCardShadow"], string> = {
  soft: "0 18px 120px -90px rgba(15, 23, 42, 0.45)",
  none: "none",
};

const SUBTLE_SHADOW_TOKENS: Record<TeacherUiPrefs["dashboardCardShadow"], string> = {
  soft: "0 12px 80px -72px rgba(15, 23, 42, 0.32)",
  none: "none",
};

const DENSITY_TOKENS: Record<TeacherUiPrefs["density"], string> = {
  spacious: "1.08",
  comfortable: "1",
  compact: "0.86",
};

const FONT_FAMILY_TOKENS: Record<TeacherUiPrefs["fontFamily"], string> = {
  suit: '"SUIT", "Pretendard", "Pretendard Variable", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", "Helvetica", "Arial", sans-serif',
  pretendard:
    '"Pretendard", "Pretendard Variable", "SUIT", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", "Helvetica", "Arial", sans-serif',
  notoSansKr:
    '"Noto Sans KR", "SUIT", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", "Helvetica", "Arial", sans-serif',
  system: '"Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", "Helvetica", "Arial", sans-serif',
};

const FONT_PRELOADS: Partial<Record<TeacherUiPrefs["fontFamily"], string>> = {
  pretendard: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css",
  notoSansKr: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap",
};

function ensureFontPreload(fontFamily: TeacherUiPrefs["fontFamily"]) {
  if (typeof document === "undefined") return;
  const href = FONT_PRELOADS[fontFamily];
  if (!href) return;
  if (document.querySelector(`link[data-gom-font="${fontFamily}"]`)) return;

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://fonts.gstatic.com";
  preconnect.crossOrigin = "anonymous";
  preconnect.setAttribute("data-gom-font", `${fontFamily}-preconnect`);
  document.head.appendChild(preconnect);

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = href;
  stylesheet.setAttribute("data-gom-font", fontFamily);
  document.head.appendChild(stylesheet);
}

export type TeacherPrefsIssue = {
  code: "PREFS_PARSE_FAILED";
  requestId: string;
};

export type TeacherPrefsSyncState = "off" | "loading" | "ok" | "offline" | "error";

export type TeacherPrefsLastError = {
  code: string;
  requestId: string;
};

export type TeacherPrefsContextValue = {
  prefs: TeacherUiPrefs;
  hydrated: boolean;
  issue: TeacherPrefsIssue | null;
  syncState: TeacherPrefsSyncState;
  lastSyncAt: string | null;
  lastError: TeacherPrefsLastError | null;
  notice: "MIGRATED" | null;
  lastRequestId: string | null;
  setPrefs: (patch: Partial<TeacherUiPrefs>) => void;
  resetPrefs: () => void;
  retrySync: () => void;
};

export const TeacherPrefsContext = createContext<TeacherPrefsContextValue | null>(null);

const resolveTeacherUiPrefs = (value: unknown) => normalizeTeacherUiPrefs(value) ?? DEFAULT_TEACHER_UI_PREFS;

function resolveRemotePrefs(value: unknown) {
  const normalized = normalizeTeacherUiPrefs(value);
  if (normalized) {
    return { prefs: normalized, migrated: false };
  }

  const patch = normalizeTeacherUiPrefsPatch(value);
  if (patch) {
    return { prefs: mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, patch), migrated: true };
  }

  return { prefs: DEFAULT_TEACHER_UI_PREFS, migrated: true };
}

export function applyTeacherPrefsToDocument(prefs: TeacherUiPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const radiusValue = `${prefs.dashboardCardRadius}px`;
  const shadowValue = SHADOW_TOKENS[prefs.dashboardCardShadow];
  const subtleShadowValue = SUBTLE_SHADOW_TOKENS[prefs.dashboardCardShadow];
  const backgroundValue =
    prefs.backgroundMode === "gradient"
      ? prefs.backgroundGradient
      : prefs.backgroundMode === "image" && prefs.backgroundImageUrl
        ? `url(${prefs.backgroundImageUrl}) center / cover no-repeat`
        : prefs.backgroundColor;

  ensureFontPreload(prefs.fontFamily);

  root.style.setProperty("--dash-card-radius", radiusValue);
  root.style.setProperty("--dash-card-shadow", shadowValue);
  root.style.setProperty("--dashboard-card-radius", radiusValue);
  root.style.setProperty("--dashboard-card-shadow", shadowValue);
  root.style.setProperty("--dashboard-card-shadow-subtle", subtleShadowValue);
  root.style.setProperty("--dashboard-density", DENSITY_TOKENS[prefs.density]);
  root.style.setProperty("--dashboard-accent", prefs.accentColor);
  root.style.setProperty("--dashboard-font-size", `${prefs.baseFontSize}px`);
  root.style.setProperty("--dashboard-font-family", FONT_FAMILY_TOKENS[prefs.fontFamily]);
  root.style.setProperty("--bg-cream", prefs.theme === "dark" ? "#0f172a" : prefs.backgroundColor);
  root.style.setProperty("--bg-ivory", prefs.theme === "dark" ? "#111827" : "#f6f1e8");
  root.style.setProperty("--ink", prefs.theme === "dark" ? "#e5e7eb" : prefs.textColor);
  root.style.setProperty("--ink-muted", prefs.theme === "dark" ? "#cbd5e1" : "#4b4136");
  root.style.setProperty("--background", prefs.theme === "dark" ? "#020617" : prefs.backgroundColor);
  root.style.setProperty("--foreground", prefs.theme === "dark" ? "#e2e8f0" : prefs.textColor);
  root.style.setProperty("--dashboard-bg", backgroundValue);
}

function parseLocalPrefs(raw: string | null): TeacherUiPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeTeacherUiPrefs(parsed);
  } catch {
    return null;
  }
}

export function useTeacherPrefsController(): TeacherPrefsContextValue {
  const [prefs, setPrefsState] = useState<TeacherUiPrefs>(DEFAULT_TEACHER_UI_PREFS);
  const [hydrated, setHydrated] = useState(false);
  const [issue, setIssue] = useState<TeacherPrefsIssue | null>(null);
  const [syncState, setSyncState] = useState<TeacherPrefsSyncState>(
    ENABLE_TEACHER_PREFS_SERVER_SYNC ? "loading" : "off",
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<TeacherPrefsLastError | null>(null);
  const [notice, setNotice] = useState<"MIGRATED" | null>(null);
  const [lastRequestId, setLastRequestIdState] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const latestPrefsRef = useRef<TeacherUiPrefs>(DEFAULT_TEACHER_UI_PREFS);
  const saveDebounceRef = useRef<number | null>(null);
  const loadInFlightRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const serverSyncEnabled = ENABLE_TEACHER_PREFS_SERVER_SYNC;

  const persistLocal = useCallback((next: TeacherUiPrefs) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TEACHER_UI_PREFS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateRequestId = useCallback((value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.trim();
    if (!normalized) return;
    setLastRequestIdState(normalized);
    setGlobalRequestId(normalized);
  }, []);

  const setSyncError = useCallback(
    (code: string, requestId: string) => {
      setLastError({ code, requestId });
      setSyncState("error");
      updateRequestId(requestId);
    },
    [updateRequestId],
  );

  const syncRemote = useCallback(
    async (nextPrefs: TeacherUiPrefs) => {
      if (!serverSyncEnabled) return;
      if (!isOnline) {
        setSyncState("offline");
        return;
      }

      const requestId = createRequestId();
      setSyncState("loading");

      try {
        const response = await fetchWithTimeout(
          routes.api.me.uiPrefs(),
          {
            method: "PUT",
            cache: "no-store",
            headers: {
              "content-type": "application/json",
              "x-client-request-id": requestId,
            },
            body: JSON.stringify({
              requestId,
              class_prefs: { teacherUiPrefs: nextPrefs },
            }),
          },
          2500,
        );

        const payload = (await response.json().catch(() => null)) as
          | { ok: true; requestId?: string; prefs?: { teacherUiPrefs?: unknown } }
          | { ok: false; requestId?: string; error?: { code?: string } }
          | null;

        const resolvedRequestId = payload?.requestId ?? requestId;

        if (!response.ok) {
          const errorCode = payload && !payload.ok ? payload.error?.code : undefined;
          setSyncError(errorCode ?? "UNKNOWN", resolvedRequestId);
          return;
        }

        if (!payload) {
          setSyncError("UNKNOWN", resolvedRequestId);
          return;
        }

        if (!payload.ok) {
          setSyncError(payload.error?.code ?? "UNKNOWN", resolvedRequestId);
          return;
        }

        const resolved = resolveTeacherUiPrefs(payload.prefs?.teacherUiPrefs ?? nextPrefs);
        updateRequestId(resolvedRequestId);
        setNotice(null);
        setLastError(null);
        setLastSyncAt(new Date().toISOString());
        setSyncState("ok");
        setPrefsState(resolved);
        latestPrefsRef.current = resolved;
        persistLocal(resolved);
      } catch (error) {
        const code = error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "UNKNOWN";
        setSyncError(code, requestId);
      }
    },
    [isOnline, persistLocal, serverSyncEnabled, setSyncError, updateRequestId],
  );

  const loadRemote = useCallback(
    async (allowRetry: boolean) => {
      if (!serverSyncEnabled) return null;
      if (!isOnline) {
        setSyncState("offline");
        return null;
      }
      if (loadInFlightRef.current) return null;

      loadInFlightRef.current = true;
      setSyncState("loading");

      type AttemptResult = { ok: true } | { ok: false; requestId: string; code: string };

      const attemptFetch = async (): Promise<AttemptResult> => {
        const requestId = createRequestId();
        try {
          const response = await fetchWithTimeout(
            routes.api.me.uiPrefs(),
            {
              method: "GET",
              cache: "no-store",
              headers: { "x-client-request-id": requestId },
            },
            2500,
          );
          const payload = (await response.json().catch(() => null)) as
            | { ok: true; requestId?: string; prefs?: { teacherUiPrefs?: unknown } }
            | { ok: false; requestId?: string; error?: { code?: string } }
            | null;

          const resolvedRequestId = payload?.requestId ?? requestId;

          if (!response.ok) {
            const errorCode = payload && !payload.ok ? payload.error?.code : undefined;
            return { ok: false, requestId: resolvedRequestId, code: errorCode ?? "UNKNOWN" };
          }

          if (!payload) {
            return { ok: false, requestId: resolvedRequestId, code: "UNKNOWN" };
          }

          if (!payload.ok) {
            return { ok: false, requestId: resolvedRequestId, code: payload.error?.code ?? "UNKNOWN" };
          }

          const { prefs: remotePrefs, migrated } = resolveRemotePrefs(payload.prefs?.teacherUiPrefs);
          updateRequestId(resolvedRequestId);
          setNotice(migrated ? "MIGRATED" : null);
          setLastError(null);
          setLastSyncAt(new Date().toISOString());
          setSyncState("ok");
          setPrefsState(remotePrefs);
          latestPrefsRef.current = remotePrefs;
          persistLocal(remotePrefs);
          return { ok: true };
        } catch (error) {
          const code = error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "UNKNOWN";
          return { ok: false, requestId, code };
        }
      };

      const first = await attemptFetch();
      if (!first.ok && allowRetry) {
        const second = await attemptFetch();
        if (!second.ok) {
          setSyncError(second.code, second.requestId);
        }
      } else if (!first.ok) {
        setSyncError(first.code, first.requestId);
      }

      loadInFlightRef.current = false;
      return null;
    },
    [isOnline, persistLocal, serverSyncEnabled, setSyncError, updateRequestId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let nextPrefs = DEFAULT_TEACHER_UI_PREFS;
    const localPrefs = parseLocalPrefs(window.localStorage.getItem(TEACHER_UI_PREFS_STORAGE_KEY));
    if (localPrefs) {
      nextPrefs = localPrefs;
    } else if (window.localStorage.getItem(TEACHER_UI_PREFS_STORAGE_KEY)) {
      const requestId = createRequestId();
      setIssue({ code: "PREFS_PARSE_FAILED", requestId });
      persistLocal(DEFAULT_TEACHER_UI_PREFS);
    }

    setPrefsState(nextPrefs);
    latestPrefsRef.current = nextPrefs;
    setHydrated(true);

    if (serverSyncEnabled) {
      if (!isOnline) {
        setSyncState("offline");
        return;
      }
      void loadRemote(true);
    } else {
      setSyncState("off");
    }
  }, [isOnline, loadRemote, persistLocal, serverSyncEnabled]);

  useEffect(() => {
    if (!hydrated) return;
    applyTeacherPrefsToDocument(prefs);
  }, [hydrated, prefs]);

  useEffect(() => {
    if (!serverSyncEnabled) return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [serverSyncEnabled]);

  useEffect(() => {
    if (!serverSyncEnabled || !hydrated) return;

    if (!isOnline) {
      wasOfflineRef.current = true;
      setSyncState("offline");
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      void loadRemote(true);
    }
  }, [hydrated, isOnline, loadRemote, serverSyncEnabled]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
      }
    };
  }, []);

  const scheduleSync = useCallback(
    (next: TeacherUiPrefs) => {
      if (!serverSyncEnabled) return;
      if (!isOnline) {
        setSyncState("offline");
        return;
      }
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
      }
      saveDebounceRef.current = window.setTimeout(() => {
        void syncRemote(next);
      }, 600);
    },
    [isOnline, serverSyncEnabled, syncRemote],
  );

  const setPrefs = useCallback(
    (patch: Partial<TeacherUiPrefs>) => {
      setPrefsState((prev) => {
        const normalizedPatch = normalizeTeacherUiPrefsPatch(patch) ?? {};
        const next = mergeTeacherUiPrefs(prev, normalizedPatch);
        latestPrefsRef.current = next;
        persistLocal(next);
        setNotice(null);
        if (serverSyncEnabled) {
          scheduleSync(next);
        }
        return next;
      });
    },
    [persistLocal, scheduleSync, serverSyncEnabled],
  );

  const resetPrefs = useCallback(() => {
    setIssue(null);
    setPrefsState(DEFAULT_TEACHER_UI_PREFS);
    latestPrefsRef.current = DEFAULT_TEACHER_UI_PREFS;
    persistLocal(DEFAULT_TEACHER_UI_PREFS);
    setNotice(null);
    if (serverSyncEnabled) {
      scheduleSync(DEFAULT_TEACHER_UI_PREFS);
    }
  }, [persistLocal, scheduleSync, serverSyncEnabled]);

  const retrySync = useCallback(() => {
    if (!serverSyncEnabled) return;
    setLastError(null);
    if (!isOnline) {
      setSyncState("offline");
      return;
    }
    void loadRemote(false);
  }, [isOnline, loadRemote, serverSyncEnabled]);

  return useMemo(
    () => ({
      prefs,
      hydrated,
      issue,
      syncState,
      lastSyncAt,
      lastError,
      notice,
      lastRequestId,
      setPrefs,
      resetPrefs,
      retrySync,
    }),
    [
      prefs,
      hydrated,
      issue,
      syncState,
      lastSyncAt,
      lastError,
      notice,
      lastRequestId,
      setPrefs,
      resetPrefs,
      retrySync,
    ],
  );
}

export function useTeacherPrefs() {
  const context = useContext(TeacherPrefsContext);
  if (!context) {
    throw new Error("useTeacherPrefs must be used within TeacherPrefsProvider");
  }
  return context;
}
