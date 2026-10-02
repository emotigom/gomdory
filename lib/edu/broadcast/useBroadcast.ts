"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiV1Path } from "@/lib/standards/pathTypes";

type BroadcastData = {
  message: string;
  ctaType: string | null;
  ctaLabel: string | null;
  updatedAt: string;
  version: number;
};

type BroadcastResponse =
  | { ok: true; broadcast: BroadcastData | null }
  | { ok: false; error?: { message?: string } };

const POLL_INTERVAL = 15000;

function getSeenVersion(boardId: string) {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(`edu:broadcast:${boardId}:seen`);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function setSeenVersion(boardId: string, version: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`edu:broadcast:${boardId}:seen`, String(version));
}

export function useBroadcast(boardId: string | null) {
  const [data, setData] = useState<BroadcastData | null>(null);
  const [visible, setVisible] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    if (boardId && data?.version) {
      setSeenVersion(boardId, data.version);
    }
    setVisible(false);
  }, [boardId, data?.version]);

  const load = useCallback(async () => {
    if (!boardId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams({ boardId });
      const response = await fetch(`${apiV1Path("edu/broadcast/public")}?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as BroadcastResponse | null;
      if (!response.ok || !payload || !payload.ok) return;

      const broadcast = payload.broadcast;
      setData(broadcast);
      if (!broadcast?.message) {
        setVisible(false);
        return;
      }

      const seenVersion = getSeenVersion(boardId);
      if (broadcast.version > seenVersion) {
        setVisible(true);
        setSeenVersion(boardId, broadcast.version);
      } else {
        setVisible(false);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL);
    return () => {
      window.clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [boardId, load]);

  return { data, visible, dismiss };
}
