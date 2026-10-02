"use client";

import { useCallback, useMemo, useState } from "react";

export type HistoryEntry<T> = {
  state: T;
  label: string;
  timestamp: number;
  mergeKey?: string;
};

type HistoryState<T> = {
  past: HistoryEntry<T>[];
  present: HistoryEntry<T>;
  future: HistoryEntry<T>[];
};

type PushOptions = {
  label: string;
  mergeKey?: string;
  mergeWindowMs?: number;
};

type UseHistoryStateOptions<T> = {
  maxDepth?: number;
  initialLabel?: string;
  isEqual?: (a: T, b: T) => boolean;
};

export default function useHistoryState<T>(
  initialState: T,
  { maxDepth = 10, initialLabel = "초기 상태", isEqual = Object.is }: UseHistoryStateOptions<T> = {},
) {
  const [history, setHistory] = useState<HistoryState<T>>(() => {
    const now = Date.now();
    return {
      past: [],
      present: { state: initialState, label: initialLabel, timestamp: now },
      future: [],
    };
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const push = useCallback(
    (nextState: T, { label, mergeKey, mergeWindowMs = 0 }: PushOptions) => {
      setHistory((current) => {
        if (isEqual(current.present.state, nextState)) {
          return current;
        }

        const now = Date.now();
        const shouldMerge =
          mergeKey &&
          current.present.mergeKey === mergeKey &&
          mergeWindowMs > 0 &&
          now - current.present.timestamp < mergeWindowMs;

        if (shouldMerge) {
          return {
            ...current,
            present: {
              state: nextState,
              label,
              timestamp: now,
              mergeKey,
            },
          };
        }

        const past = [...current.past, current.present];
        if (past.length > maxDepth) {
          past.splice(0, past.length - maxDepth);
        }

        return {
          past,
          present: {
            state: nextState,
            label,
            timestamp: now,
            mergeKey,
          },
          future: [],
        };
      });
    },
    [isEqual, maxDepth],
  );

  const undo = useCallback<() => HistoryEntry<T> | null>(() => {
    let nextEntry: HistoryEntry<T> | null = null;

    setHistory((current) => {
      if (current.past.length === 0) {
        return current;
      }

      const previous = current.past[current.past.length - 1];
      nextEntry = previous;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });

    return nextEntry;
  }, []);

  const redo = useCallback<() => HistoryEntry<T> | null>(() => {
    let nextEntry: HistoryEntry<T> | null = null;

    setHistory((current) => {
      if (current.future.length === 0) {
        return current;
      }

      const next = current.future[0];
      nextEntry = next;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });

    return nextEntry;
  }, []);

  const jumpToPast = useCallback<(index: number) => HistoryEntry<T> | null>((index: number) => {
    let nextEntry: HistoryEntry<T> | null = null;

    setHistory((current) => {
      if (index < 0 || index >= current.past.length) {
        return current;
      }

      const target = current.past[index];
      nextEntry = target;
      const remainingPast = current.past.slice(0, index);
      const future = [...current.past.slice(index + 1), current.present, ...current.future];

      return {
        past: remainingPast,
        present: target,
        future,
      };
    });

    return nextEntry;
  }, []);

  const recentEntries = useMemo(() => {
    const combined = [...history.past, history.present];
    return combined.map((entry, index) => ({
      entry,
      index,
    }));
  }, [history.past, history.present]);

  return {
    canRedo,
    canUndo,
    history,
    past: history.past,
    present: history.present,
    future: history.future,
    push,
    redo,
    undo,
    jumpToPast,
    recentEntries,
  };
}
