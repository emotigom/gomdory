"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DASHBOARD_FOLDERS,
  normalizeBoardFolderMap,
  normalizeFolders,
  type BoardFolderMap,
  type DashboardFolder,
} from "./boardFolders";

export type DashboardUiPrefs = {
  dashboardCleanView: boolean;
  folders: DashboardFolder[];
  boardFolderMap: BoardFolderMap;
};

type UiPrefsNotice = {
  title: string;
  description?: string;
  actionLabel?: string;
};

type UiPrefsResult = {
  prefs: DashboardUiPrefs;
  notice: UiPrefsNotice | null;
  updatePrefs: (patch: Partial<DashboardUiPrefs>) => void;
  retryRemote: () => void;
};

const DEFAULT_PREFS: DashboardUiPrefs = {
  dashboardCleanView: false,
  folders: DEFAULT_DASHBOARD_FOLDERS,
  boardFolderMap: {},
};

const STORAGE_KEY = "gom:dashboard:ui-prefs";

function safeParsePrefs(raw: string | null): Partial<DashboardUiPrefs> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardUiPrefs>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function normalizePrefs(input: Partial<DashboardUiPrefs>): DashboardUiPrefs {
  const folders = normalizeFolders(input.folders);
  return {
    dashboardCleanView: typeof input.dashboardCleanView === "boolean" ? input.dashboardCleanView : DEFAULT_PREFS.dashboardCleanView,
    folders,
    boardFolderMap: normalizeBoardFolderMap(input.boardFolderMap, folders),
  };
}

export function getFolders(prefs: DashboardUiPrefs): DashboardFolder[] {
  return prefs.folders;
}

export function setFolders(prefs: DashboardUiPrefs, folders: DashboardFolder[]): DashboardUiPrefs {
  const nextFolders = normalizeFolders(folders);
  return {
    ...prefs,
    folders: nextFolders,
    boardFolderMap: normalizeBoardFolderMap(prefs.boardFolderMap, nextFolders),
  };
}

export function setBoardFolder(
  prefs: DashboardUiPrefs,
  boardId: string,
  folderId: string | null,
): DashboardUiPrefs {
  if (!boardId) return prefs;
  const validIds = new Set(prefs.folders.map((folder) => folder.id));
  const nextMap = { ...prefs.boardFolderMap };
  if (!folderId || !validIds.has(folderId)) {
    delete nextMap[boardId];
  } else {
    nextMap[boardId] = folderId;
  }
  return { ...prefs, boardFolderMap: nextMap };
}

function createFallbackNotice(): UiPrefsNotice {
  return {
    title: "네트워크 문제로 로컬 설정만 사용하고 있어요.",
    description: "연결이 복구되면 다시 동기화해 주세요.",
    actionLabel: "다시 시도",
  };
}

export default function useDashboardUiPrefs(initialCleanView = false): UiPrefsResult {
  const [prefs, setPrefs] = useState<DashboardUiPrefs>(DEFAULT_PREFS);
  const [notice, setNotice] = useState<UiPrefsNotice | null>(null);
  const [remoteAvailable, setRemoteAvailable] = useState(true);

  const persistPrefs = useCallback((next: DashboardUiPrefs) => {
    setPrefs(next);
    if (typeof window === "undefined") return;
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
        | { ok: true; prefs: Partial<DashboardUiPrefs> }
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
    if (typeof window === "undefined") return;

    const cached = normalizePrefs({ ...DEFAULT_PREFS, ...safeParsePrefs(window.localStorage.getItem(STORAGE_KEY)) });
    const initial = initialCleanView ? { ...cached, dashboardCleanView: true } : cached;
    setPrefs(initial);

    let cancelled = false;
    const run = async () => {
      const remotePrefs = await loadRemote();
      if (cancelled || !remotePrefs) return;

      const nextPrefs = initialCleanView ? { ...remotePrefs, dashboardCleanView: true } : remotePrefs;
      persistPrefs(nextPrefs);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [initialCleanView, loadRemote, persistPrefs]);

  const updatePrefs = useCallback(
    (patch: Partial<DashboardUiPrefs>) => {
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
              body: JSON.stringify({
                classPrefs: {
                  dashboardCleanView: next.dashboardCleanView,
                  folders: next.folders,
                  boardFolderMap: next.boardFolderMap,
                },
              }),
            });

            const data = (await response.json()) as
              | { ok: true; prefs: Partial<DashboardUiPrefs> }
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
