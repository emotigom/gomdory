"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Filters = {
  q: string;
  includeHidden: boolean;
};

const REFRESH_INTERVAL_MS = 10_000;

function useFilters(): [Filters, (next: Partial<Filters>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo<Filters>(
    () => ({
      q: searchParams.get("q") ?? "",
      includeHidden: searchParams.get("includeHidden") === "1",
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged: Filters = { ...filters, ...next };

      if (merged.q) {
        params.set("q", merged.q);
      } else {
        params.delete("q");
      }

      if (merged.includeHidden) {
        params.set("includeHidden", "1");
      } else {
        params.delete("includeHidden");
      }

      params.delete("offset");

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [filters, pathname, router, searchParams],
  );

  return [filters, setFilters];
}

export default function CardListControls({ variant = "actions" }: { variant?: "actions" | "filters" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useFilters();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshFirstPage = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("offset")) {
      params.delete("offset");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
    router.refresh();
  }, [pathname, router, searchParams]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    refreshFirstPage();
    setTimeout(() => setIsRefreshing(false), 300);
  }, [isRefreshing, refreshFirstPage]);

  useEffect(() => {
    if (variant !== "actions" || !autoRefresh) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshFirstPage();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh, refreshFirstPage, variant]);

  if (variant === "actions") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setAutoRefresh((prev) => !prev)}
          className={`h-9 rounded-md border px-3 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 ${
            autoRefresh
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-white text-gray-800"
          }`}
        >
          자동 새로고침 {autoRefresh ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 font-medium text-gray-800 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {isRefreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 items-center gap-2">
        <label className="text-gray-700" htmlFor="card-search">
          검색
        </label>
        <input
          id="card-search"
          type="search"
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
          placeholder="닉네임 또는 본문 검색"
          className="h-9 w-full min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 text-sm shadow-sm focus-visible:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={filters.includeHidden}
          onChange={(event) => setFilters({ includeHidden: event.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-black focus-visible:ring-2 focus-visible:ring-gray-900/20"
        />
        <span>숨김 포함</span>
      </label>
    </>
  );
}
