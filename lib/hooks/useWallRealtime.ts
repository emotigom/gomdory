import { useCallback, useEffect, useMemo, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type WallRealtimeOptions = {
  debounceMs?: number;
  enabled?: boolean;
};

type WallRealtimeHandle = {
  markDirty: (wallId: string) => void;
  activeWallIds: string[];
};

const DEFAULT_DEBOUNCE_MS = 500;
const MAX_WALL_SUBSCRIPTIONS = 12;

function toWallSet(wallIds: string[], maxSubscriptions: number) {
  const unique = Array.from(new Set(wallIds.filter(Boolean)));
  return unique.slice(0, Math.max(1, maxSubscriptions));
}

export function useWallRealtime(
  wallIds: string[],
  onDirty: (wallId: string) => void,
  options: WallRealtimeOptions = {},
): WallRealtimeHandle {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;
  const timersRef = useRef<Map<string, number>>(new Map());
  const clientRef = useRef<ReturnType<typeof createSupabaseBrowserClient>>(null);

  const activeWallIds = useMemo(
    () => toWallSet(wallIds, MAX_WALL_SUBSCRIPTIONS),
    [wallIds],
  );

  const markDirty = useCallback(
    (wallId: string) => {
      if (!wallId) return;
      const existing = timersRef.current.get(wallId);
      if (existing) {
        window.clearTimeout(existing);
      }
      const timer = window.setTimeout(() => {
        timersRef.current.delete(wallId);
        onDirty(wallId);
      }, debounceMs);
      timersRef.current.set(wallId, timer);
    },
    [debounceMs, onDirty],
  );

  useEffect(() => {
    if (!enabled) return;
    const client = clientRef.current ?? createSupabaseBrowserClient();
    clientRef.current = client;
    if (!client) return;
    if (activeWallIds.length === 0) return;

    const timers = timersRef.current;
    const channels = activeWallIds.map((wallId) => {
      const channelName = `wall-realtime:${wallId}:${Math.random().toString(36).slice(2, 8)}`;
      return client
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cards", filter: `wall_id=eq.${wallId}` },
          () => {
            markDirty(wallId);
          },
        )
        .subscribe((status) => {
          if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            markDirty(wallId);
          }
        });
    });

    return () => {
      channels.forEach((channel) => {
        client.removeChannel(channel);
      });
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [activeWallIds, enabled, markDirty]);

  return { markDirty, activeWallIds };
}
