"use client";

import { useEffect, useState } from "react";

export type ShareSortOrder = "latest" | "oldest";
export type ShareColumnCount = 1 | 2 | 3 | 4 | "auto";

type ShareViewPrefs = {
  columnCount: ShareColumnCount;
  sortOrder: ShareSortOrder;
  tvMode: boolean;
};

const DEFAULT_PREFS: ShareViewPrefs = {
  columnCount: "auto",
  sortOrder: "latest",
  tvMode: false,
};

function getStorageKey(boardId: string) {
  return `share-view-prefs:${boardId}`;
}

function parsePrefs(value: string | null): ShareViewPrefs {
  if (!value) return DEFAULT_PREFS;

  try {
    const parsed = JSON.parse(value) as Partial<ShareViewPrefs> | null;
    if (!parsed) return DEFAULT_PREFS;

    const columnCount: ShareColumnCount =
      parsed.columnCount === 1 ||
      parsed.columnCount === 2 ||
      parsed.columnCount === 3 ||
      parsed.columnCount === 4 ||
      parsed.columnCount === "auto"
        ? parsed.columnCount
        : DEFAULT_PREFS.columnCount;

    return {
      columnCount,
      sortOrder:
        parsed.sortOrder === "oldest" || parsed.sortOrder === "latest"
          ? parsed.sortOrder
          : DEFAULT_PREFS.sortOrder,
      tvMode: parsed.tvMode ?? DEFAULT_PREFS.tvMode,
    } satisfies ShareViewPrefs;
  } catch (error) {
    console.error("Failed to parse share view prefs", error);
  }

  return DEFAULT_PREFS;
}

export function useShareViewPrefs(boardId: string, initialTvMode?: boolean) {
  const [prefs, setPrefs] = useState<ShareViewPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!boardId) return;
    setPrefs(parsePrefs(window.localStorage.getItem(getStorageKey(boardId))));
    setLoaded(true);
  }, [boardId]);

  useEffect(() => {
    if (!loaded || !boardId) return;
    if (initialTvMode) {
      setPrefs((prev) => ({ ...prev, tvMode: true }));
    }
  }, [boardId, initialTvMode, loaded]);

  useEffect(() => {
    if (!boardId || !loaded) return;
    window.localStorage.setItem(getStorageKey(boardId), JSON.stringify(prefs));
  }, [boardId, loaded, prefs]);

  return {
    columnCount: prefs.columnCount,
    setColumnCount: (columnCount: ShareColumnCount) =>
      setPrefs((prev) => ({ ...prev, columnCount })),
    sortOrder: prefs.sortOrder,
    setSortOrder: (sortOrder: ShareSortOrder) =>
      setPrefs((prev) => ({ ...prev, sortOrder })),
    tvMode: prefs.tvMode,
    setTvMode: (tvMode: boolean) => setPrefs((prev) => ({ ...prev, tvMode })),
  };
}
