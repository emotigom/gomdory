"use client";

import { useCallback, useEffect, useRef } from "react";

import { useWallRealtime } from "@/lib/hooks/useWallRealtime";
import { routes } from "@/lib/standards/routes";

import type {
  TeacherBoardSyncPayload,
  TeacherBoardWallEntry,
} from "./teacherBoardSnapshot";

export const TEACHER_BOARD_SYNC_INTERVAL_MS = 7_000;

type TeacherBoardSyncReason =
  | "poll"
  | "visible"
  | "realtime"
  | "queued"
  | "unblocked";

type UseTeacherBoardLiveSyncInput = {
  boardId: string;
  wallIds: string[];
  blocked: boolean;
  enabled?: boolean;
  realtimeEnabled?: boolean;
  onSnapshot: (
    walls: TeacherBoardWallEntry[],
    stateVersion: number | undefined,
  ) => void;
};

export function useTeacherBoardLiveSync({
  boardId,
  wallIds,
  blocked,
  enabled = true,
  realtimeEnabled = true,
  onSnapshot,
}: UseTeacherBoardLiveSyncInput) {
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const blockedRef = useRef(blocked);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestSyncRef = useRef<
    ((reason: TeacherBoardSyncReason) => Promise<void>) | null
  >(null);
  const onSnapshotRef = useRef(onSnapshot);

  blockedRef.current = blocked;
  onSnapshotRef.current = onSnapshot;

  const requestSync = useCallback(
    async () => {
      if (!enabled || typeof window === "undefined") return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      if (blockedRef.current) {
        queuedRef.current = true;
        return;
      }
      if (inFlightRef.current) {
        queuedRef.current = true;
        return;
      }

      inFlightRef.current = true;
      queuedRef.current = false;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          routes.api.v1("dashboard", "boards", boardId, "sync"),
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | TeacherBoardSyncPayload
          | null;

        if (!response.ok || !payload?.walls) return;
        if (payload.boardId && payload.boardId !== boardId) return;

        if (blockedRef.current) {
          queuedRef.current = true;
          return;
        }

        onSnapshotRef.current(payload.walls, payload.stateVersion);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.debug("[teacher-board-sync] retry later", error);
        }
      } finally {
        inFlightRef.current = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (
          queuedRef.current &&
          !blockedRef.current &&
          (typeof document === "undefined" ||
            document.visibilityState === "visible")
        ) {
          queuedRef.current = false;
          queueMicrotask(() => {
            void requestSyncRef.current?.("queued");
          });
        }
      }
    },
    [boardId, enabled],
  );

  requestSyncRef.current = requestSync;

  const handleRealtimeDirty = useCallback(() => {
    void requestSyncRef.current?.("realtime");
  }, []);

  useWallRealtime(wallIds, handleRealtimeDirty, { enabled: enabled && realtimeEnabled });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleNext = () => {
      clearTimer();
      timerRef.current = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await requestSyncRef.current?.("poll");
        }
        scheduleNext();
      }, TEACHER_BOARD_SYNC_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestSyncRef.current?.("visible");
        scheduleNext();
      } else {
        clearTimer();
      }
    };

    scheduleNext();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimer();
      abortRef.current?.abort();
      abortRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled && !blocked && queuedRef.current && !inFlightRef.current) {
      queuedRef.current = false;
      void requestSyncRef.current?.("unblocked");
    }
  }, [blocked, enabled]);
}
