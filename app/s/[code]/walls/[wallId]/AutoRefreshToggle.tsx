"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const REFRESH_INTERVAL = 5000;

export default function AutoRefreshToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshFirstPage = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("offset")) {
      params.delete("offset");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
    router.refresh();
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (enabled) {
      intervalRef.current = setInterval(() => {
        refreshFirstPage();
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, refreshFirstPage]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((prev) => !prev)}
      className="w-full rounded-xl bg-gray-900 px-4 py-3 text-lg font-semibold text-white transition hover:bg-gray-800"
    >
      자동 새로고침: {enabled ? "ON" : "OFF"}
    </button>
  );
}
