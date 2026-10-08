"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CommandAction = () => void;

export type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  keywords: string[];
  enabled: boolean;
  run: CommandAction;
};

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function useCommandPalette(items: CommandPaletteItem[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedQuery = useMemo(() => normalizeKeyword(query), [query]);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }
    return items.filter((item) => {
      const haystack = [item.label, ...item.keywords].map(normalizeKeyword).join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery, isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setQuery("");
      }
      return !prev;
    });
  }, []);

  const moveActive = useCallback(
    (delta: number) => {
      if (filteredItems.length === 0) {
        return;
      }
      setActiveIndex((prev) => {
        const next = (prev + delta + filteredItems.length) % filteredItems.length;
        return next;
      });
    },
    [filteredItems.length],
  );

  const runActive = useCallback(() => {
    const item = filteredItems[activeIndex];
    if (!item || !item.enabled) {
      return;
    }
    item.run();
    close();
  }, [activeIndex, close, filteredItems]);

  const runItem = useCallback(
    (item: CommandPaletteItem) => {
      if (!item.enabled) {
        return;
      }
      item.run();
      close();
    },
    [close],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runActive();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen, moveActive, runActive]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return {
    isOpen,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    filteredItems,
    open,
    close,
    toggle,
    runItem,
  };
}
