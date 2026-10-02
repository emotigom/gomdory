"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PresentSnapshot } from "./loadPresentData";

type RecentCardEntry = {
  cardId: string;
  createdAt?: string;
  addedAt: number;
};

const RECENT_BADGE_MS = 2 * 60 * 1000;
const RECENT_RETENTION_MS = 5 * 60 * 1000;

export function useRecentCards(initialSnapshot: PresentSnapshot) {
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [recentCards, setRecentCards] = useState<Record<string, RecentCardEntry>>({});
  const knownCardIdsRef = useRef<Set<string>>(new Set(initialSnapshot.cards.map((card) => card.id)));
  const lastVersionRef = useRef(initialSnapshot.version);
  const lastWallRef = useRef(initialSnapshot.selectedWallId);

  const cleanupOldEntries = useCallback(() => {
    const now = Date.now();
    setRecentCards((prev) => {
      const next = Object.fromEntries(
        Object.values(prev)
          .filter((entry) => now - entry.addedAt < RECENT_RETENTION_MS)
          .map((entry) => [entry.cardId, entry]),
      );
      return next;
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(cleanupOldEntries, 30_000);
    return () => window.clearInterval(interval);
  }, [cleanupOldEntries]);

  const registerSnapshot = useCallback(
    (snapshot: PresentSnapshot) => {
      if (snapshot.version === lastVersionRef.current && snapshot.selectedWallId === lastWallRef.current) {
        return;
      }

      lastVersionRef.current = snapshot.version;
      lastWallRef.current = snapshot.selectedWallId;

      const known = new Set(knownCardIdsRef.current);
      const now = Date.now();

      const newCards = snapshot.cards.filter((card) => !known.has(card.id));
      if (newCards.length === 0) {
        cleanupOldEntries();
        return;
      }

      newCards.forEach((card) => known.add(card.id));
      knownCardIdsRef.current = known;

      setRecentCards((prev) => {
        const next = { ...prev };
        newCards.forEach((card) => {
          next[card.id] = { cardId: card.id, createdAt: card.createdAt, addedAt: now };
        });
        return next;
      });
    },
    [cleanupOldEntries],
  );

  const recentIds = useMemo(() => new Set(Object.keys(recentCards)), [recentCards]);

  const recentCount = useMemo(() => {
    const now = Date.now();
    return Object.values(recentCards).filter((entry) => now - entry.addedAt < RECENT_RETENTION_MS).length;
  }, [recentCards]);

  const isFresh = useCallback(
    (cardId: string) => {
      const entry = recentCards[cardId];
      if (!entry) return false;
      return Date.now() - entry.addedAt < RECENT_BADGE_MS;
    },
    [recentCards],
  );

  const clearRecent = useCallback(() => {
    setRecentCards({});
    setShowRecentOnly(false);
  }, []);

  return {
    recentIds,
    recentCount,
    showRecentOnly,
    isFresh,
    registerSnapshot,
    toggleRecentOnly: () => setShowRecentOnly((prev) => !prev),
    clearRecent,
  };
}
