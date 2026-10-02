"use client";

import { useEffect, useState } from "react";

export type BoardDensity = "s" | "m" | "l";

type BoardPrefs = {
  density: BoardDensity;
  autoLoad: boolean;
  searchQuery: string;
  authorFilter: string;
  attachmentsOnly: boolean;
  includeHidden: boolean;
  pinnedOnly: boolean;
  updatedToday: boolean;
};

const DEFAULT_PREFS: BoardPrefs = {
  density: "m",
  autoLoad: true,
  searchQuery: "",
  authorFilter: "",
  attachmentsOnly: false,
  includeHidden: true,
  pinnedOnly: false,
  updatedToday: false,
};

function getStorageKey(boardId: string) {
  return `board-prefs:${boardId}`;
}

function parsePrefs(value: string | null): BoardPrefs {
  if (!value) return DEFAULT_PREFS;

  try {
    const parsed = JSON.parse(value) as Partial<BoardPrefs> | null;
    if (!parsed) return DEFAULT_PREFS;

    return {
      density:
        parsed.density === "s" || parsed.density === "m" || parsed.density === "l"
          ? parsed.density
          : DEFAULT_PREFS.density,
      autoLoad: parsed.autoLoad ?? DEFAULT_PREFS.autoLoad,
      searchQuery: parsed.searchQuery ?? DEFAULT_PREFS.searchQuery,
      authorFilter: parsed.authorFilter ?? DEFAULT_PREFS.authorFilter,
      attachmentsOnly: parsed.attachmentsOnly ?? DEFAULT_PREFS.attachmentsOnly,
      includeHidden: parsed.includeHidden ?? DEFAULT_PREFS.includeHidden,
      pinnedOnly: parsed.pinnedOnly ?? DEFAULT_PREFS.pinnedOnly,
      updatedToday: parsed.updatedToday ?? DEFAULT_PREFS.updatedToday,
    } satisfies BoardPrefs;
  } catch (error) {
    console.error("Failed to parse board prefs", error);
  }

  return DEFAULT_PREFS;
}

export function useBoardPrefs(boardId: string) {
  const [prefs, setPrefs] = useState<BoardPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!boardId) return;
    setPrefs(parsePrefs(window.localStorage.getItem(getStorageKey(boardId))));
    setLoaded(true);
  }, [boardId]);

  useEffect(() => {
    if (!boardId || !loaded) return;
    window.localStorage.setItem(getStorageKey(boardId), JSON.stringify(prefs));
  }, [boardId, loaded, prefs]);

  return {
    density: prefs.density,
    setDensity: (density: BoardDensity) => setPrefs((prev) => ({ ...prev, density })),
    autoLoad: prefs.autoLoad,
    setAutoLoad: (autoLoad: boolean) => setPrefs((prev) => ({ ...prev, autoLoad })),
    searchQuery: prefs.searchQuery,
    setSearchQuery: (searchQuery: string) => setPrefs((prev) => ({ ...prev, searchQuery })),
    authorFilter: prefs.authorFilter,
    setAuthorFilter: (authorFilter: string) => setPrefs((prev) => ({ ...prev, authorFilter })),
    attachmentsOnly: prefs.attachmentsOnly,
    setAttachmentsOnly: (attachmentsOnly: boolean) =>
      setPrefs((prev) => ({ ...prev, attachmentsOnly })),
    includeHidden: prefs.includeHidden,
    setIncludeHidden: (includeHidden: boolean) =>
      setPrefs((prev) => ({ ...prev, includeHidden })),
    pinnedOnly: prefs.pinnedOnly,
    setPinnedOnly: (pinnedOnly: boolean) => setPrefs((prev) => ({ ...prev, pinnedOnly })),
    updatedToday: prefs.updatedToday,
    setUpdatedToday: (updatedToday: boolean) =>
      setPrefs((prev) => ({ ...prev, updatedToday })),
  };
}
