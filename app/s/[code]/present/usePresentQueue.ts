"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type QueueEntry = {
  cardId: string;
  wallId?: string | null;
  addedAt: number;
};

const STORAGE_PREFIX = "presentQueue:";

function readQueue(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(key: string, entries: QueueEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(entries));
}

export function usePresentQueue(shareCode: string) {
  const storageKey = `${STORAGE_PREFIX}${shareCode}`;
  const [queue, setQueue] = useState<QueueEntry[]>(() => readQueue(storageKey));
  const [lastOpened, setLastOpened] = useState<QueueEntry | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    setQueue(readQueue(storageKey));
  }, [storageKey]);

  useEffect(() => {
    writeQueue(storageKey, queue);
  }, [queue, storageKey]);

  const queuedIds = useMemo(() => new Set(queue.map((item) => item.cardId)), [queue]);

  const addToQueue = useCallback(
    (cardId: string, wallId?: string | null) => {
      setQueue((prev) => {
        if (prev.some((entry) => entry.cardId === cardId)) return prev;
        const entry: QueueEntry = { cardId, wallId, addedAt: Date.now() };
        return [...prev, entry];
      });
    },
    [],
  );

  const removeFromQueue = useCallback((cardId: string) => {
    setQueue((prev) => prev.filter((entry) => entry.cardId !== cardId));
  }, []);

  const moveUp = useCallback((cardId: string) => {
    setQueue((prev) => {
      const index = prev.findIndex((entry) => entry.cardId === cardId);
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((cardId: string) => {
    setQueue((prev) => {
      const index = prev.findIndex((entry) => entry.cardId === cardId);
      if (index < 0 || index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const popNext = useCallback(() => {
    let nextEntry: QueueEntry | undefined;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [, ...rest] = prev;
      nextEntry = prev[0];
      return rest;
    });
    if (nextEntry) {
      setLastOpened(nextEntry);
    }
    return nextEntry ?? null;
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setLastOpened(null);
  }, []);

  const togglePanel = useCallback(() => setPanelOpen((prev) => !prev), []);

  return {
    queue,
    queuedIds,
    panelOpen,
    lastOpened,
    addToQueue,
    removeFromQueue,
    moveUp,
    moveDown,
    popNext,
    clearQueue,
    togglePanel,
    setPanelOpen,
  };
}
