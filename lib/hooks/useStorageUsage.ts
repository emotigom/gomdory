"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getFreeQuotaBytes } from "@/lib/billing/plan";
import { apiFetch } from "@/lib/http/apiFetch";

export type StorageUsageSnapshot = {
  day: string;
  r2Bytes: number;
  dbBytes: number;
  filesCount: number;
  optimizedBytesSaved: number;
};

type StorageUsageApiResponse = {
  ok: boolean;
  quotaBytes?: number;
  latest?: StorageUsageSnapshot;
  trend?: StorageUsageSnapshot[];
  error?: { code: string; message: string };
  requestId?: string;
};

type UseStorageUsageOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

type StorageUsageState = {
  latest: StorageUsageSnapshot | null;
  trend: StorageUsageSnapshot[];
  quotaBytes: number;
  loading: boolean;
  error: string | null;
  requestId?: string;
};

const DEFAULT_REFRESH_INTERVAL = 45_000;

export function useStorageUsage(options: UseStorageUsageOptions = {}) {
  const { enabled = true, refreshIntervalMs = DEFAULT_REFRESH_INTERVAL } = options;
  const refreshingRef = useRef(false);
  const fallbackQuotaBytes = getFreeQuotaBytes();
  const [state, setState] = useState<StorageUsageState>({
    latest: null,
    trend: [],
    quotaBytes: fallbackQuotaBytes,
    loading: enabled,
    error: null,
  });

  const refresh = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!enabled || refreshingRef.current) return;
      refreshingRef.current = true;

      setState((prev) => ({
        ...prev,
        loading: silent ? prev.loading && !prev.latest : true,
        error: silent ? prev.error : null,
      }));

      try {
        const response = await apiFetch(apiV1Path("storage/usage"), { cache: "no-store" });
        const payload = (await response.json()) as StorageUsageApiResponse;
        const requestId = payload.requestId ?? response.headers.get("x-request-id") ?? undefined;

        if (!response.ok || !payload.ok || !payload.latest) {
          const message = payload.error?.message ?? "불러오기 실패";
          setState((prev) => ({
            ...prev,
            error: message,
            loading: false,
            requestId,
          }));
          return;
        }

        setState((prev) => ({
          latest: payload.latest ?? prev.latest,
          trend: payload.trend ?? prev.trend,
          quotaBytes: payload.quotaBytes ?? prev.quotaBytes,
          loading: false,
          error: null,
          requestId,
        }));
      } catch (error) {
        console.error("[storage] usage fetch failed", error);
        setState((prev) => ({
          ...prev,
          error: "불러오기 실패",
          loading: false,
        }));
      } finally {
        refreshingRef.current = false;
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !refreshIntervalMs) return;
    const handle = window.setInterval(() => {
      void refresh({ silent: true });
    }, refreshIntervalMs);
    return () => window.clearInterval(handle);
  }, [enabled, refresh, refreshIntervalMs]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [refresh, state],
  );
}
