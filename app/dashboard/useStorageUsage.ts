"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";

import type { StorageSummary } from "@/lib/data/storageSummary";

export type StorageUsageSnapshot = {
  day: string;
  r2Bytes: number;
  dbBytes: number;
  filesCount: number;
  optimizedBytesSaved: number;
};

export type StorageUsageApiResponse = {
  ok: boolean;
  quotaBytes?: number;
  latest?: StorageUsageSnapshot;
  trend?: StorageUsageSnapshot[];
  error?: { code?: string; message?: string };
  requestId?: string;
};

export type StorageSavingsPayload = {
  totalSavedBytes: number;
  savedThisMonthBytes: number;
};

type StorageSummaryResponse = {
  ok?: boolean;
  summary?: StorageSummary;
  error?: { code?: string; message?: string };
  requestId?: string;
};

type StorageSavingsResponse = {
  ok?: boolean;
  totalSavedBytes?: number;
  savedThisMonthBytes?: number;
  error?: { code?: string; message?: string };
  requestId?: string;
};

export type StorageUsageResponse = {
  usage: StorageUsageApiResponse | null;
  summary: StorageSummary | null;
  savings: StorageSavingsPayload | null;
};

const STALE_MS = 60_000;
let cachedUsage: { data: StorageUsageResponse | null; fetchedAt: number } | null = null;

export function useStorageUsage() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    data: StorageUsageResponse | null;
  }>(() => {
    if (cachedUsage && Date.now() - cachedUsage.fetchedAt < STALE_MS && cachedUsage.data?.usage?.ok) {
      return { loading: false, error: null, data: cachedUsage.data };
    }
    return { loading: true, error: null, data: null };
  });

  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [usageRes, summaryRes, savingsRes] = await Promise.all([
        apiFetch(apiV1Path("storage/usage"), { cache: "no-store" }),
        apiFetch(apiV1Path("storage/summary"), { cache: "no-store" }),
        apiFetch(apiV1Path("storage/savings"), { cache: "no-store" }),
      ]);

      const usagePayload = (await usageRes.json()) as StorageUsageApiResponse;
      const summaryPayload = (await summaryRes.json()) as StorageSummaryResponse;
      const savingsPayload = (await savingsRes.json()) as StorageSavingsResponse;

      const usageResolved: StorageUsageApiResponse = {
        ...usagePayload,
        requestId: usagePayload.requestId ?? usageRes.headers.get("x-request-id") ?? undefined,
      };

      if (!usageRes.ok || !usageResolved.ok) {
        setState({ loading: false, error: usageResolved.error?.message ?? "불러오기 실패", data: null });
        return;
      }

      const summary = summaryPayload.ok === false ? null : summaryPayload.summary ?? null;
      const savings =
        savingsPayload.ok === false
          ? null
          : {
              totalSavedBytes: savingsPayload.totalSavedBytes ?? 0,
              savedThisMonthBytes: savingsPayload.savedThisMonthBytes ?? 0,
            };

      const data: StorageUsageResponse = {
        usage: usageResolved,
        summary,
        savings,
      };

      cachedUsage = { data, fetchedAt: Date.now() };
      setState({ loading: false, error: null, data });
    } catch (error) {
      console.error("[storage] usage fetch failed", error);
      setState((prev) => ({ ...prev, loading: false, error: "불러오기 실패" }));
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [refresh, state],
  );
}
