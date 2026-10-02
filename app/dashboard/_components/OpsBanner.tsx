"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useEffect, useState } from "react";

import { cn } from "@/app/_components/uiTokens";

type OpsBannerPayload = {
  message: string | null;
  level?: "info" | "warning" | "error" | string;
  updatedAt?: string | null;
};

const toneMap: Record<string, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export default function OpsBanner() {
  const [banner, setBanner] = useState<OpsBannerPayload | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(apiV1Path("ops/banner"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { ok?: boolean } & OpsBannerPayload;
      })
      .then((payload) => {
        if (!alive || !payload?.message) return;
        setBanner(payload);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  if (!banner?.message) {
    return null;
  }

  const toneClass = toneMap[banner.level ?? "info"] ?? toneMap.info;

  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm font-medium", toneClass)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide">운영 알림</span>
        <span className="text-xs text-black/50">시스템</span>
        {banner.updatedAt ? (
          <span className="text-xs text-black/40">{new Date(banner.updatedAt).toLocaleString()}</span>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{banner.message}</p>
    </div>
  );
}
