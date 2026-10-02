import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ClientMessage, RealtimeEvent, decodeRealtimeEvent } from "./events";

type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

type RealtimeClientOptions = {
  boardId: string;
  shareCode?: string | null;
  role: "teacher" | "student";
  onEvent: (event: RealtimeEvent) => void;
};

function buildUrl(boardId: string, shareCode?: string | null) {
  const url = new URL("/api/realtime", window.location.origin);
  url.searchParams.set("boardId", boardId);
  if (shareCode) {
    url.searchParams.set("shareCode", shareCode);
  }
  return url;
}

export function useRealtimeClient({ boardId, shareCode, role, onEvent }: RealtimeClientOptions) {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const retryRef = useRef(500);
  const closedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const sendJoin = useCallback(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const message: ClientMessage = { type: "join", boardId, shareCode, role };
    socket.send(JSON.stringify(message));
  }, [boardId, role, shareCode]);

  const connect = useCallback(() => {
    if (!boardId || typeof window === "undefined") return;
    const url = buildUrl(boardId, shareCode);
    const socket = new WebSocket(url);
    wsRef.current = socket;
    socket.addEventListener("open", () => {
      closedRef.current = false;
      setStatus("live");
      retryRef.current = 500;
      sendJoin();
    });
    socket.addEventListener("message", (event) => {
      const parsed = decodeRealtimeEvent(event.data);
      if (!parsed) return;
      onEvent(parsed);
    });
    socket.addEventListener("close", () => {
      if (closedRef.current) return;
      setStatus("reconnecting");
      const nextDelay = Math.min(retryRef.current * 2, 8000);
      const delay = retryRef.current;
      retryRef.current = nextDelay;
      window.setTimeout(() => {
        if (!closedRef.current) {
          connect();
        }
      }, delay);
    });
    socket.addEventListener("error", () => {
      socket.close();
      setStatus("offline");
    });
  }, [boardId, onEvent, sendJoin, shareCode]);

  useEffect(() => {
    connect();
    return () => {
      closedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const statusLabel = useMemo(() => {
    if (status === "live") return "Live";
    if (status === "reconnecting") return "Reconnecting";
    if (status === "offline") return "Offline";
    return "Connecting";
  }, [status]);

  return { status, statusLabel } as const;
}
