"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiV1Path } from "@/lib/standards/pathTypes";
import { apiFetch } from "@/lib/http/apiFetch";
import { cn, surface } from "@/app/_components/uiTokens";

type WallpaperItem = {
  key: string;
  name: string;
  url: string;
};

type WallpapersResponse = {
  ok: boolean;
  wallpapers?: WallpaperItem[];
  truncated?: boolean;
  error?: string;
};

type BoardDesignPanelProps = {
  boardId: string;
  selectedKey: string | null;
  onSelect: (key: string, url: string) => void;
  onReset: () => void;
  saveState?: "idle" | "saving" | "error";
};

export default function BoardDesignPanel({ boardId, selectedKey, onSelect, onReset, saveState = "idle" }: BoardDesignPanelProps) {
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const fetchWallpapers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/wallpapers`), { cache: "no-store" });
      const payload = (await response.json()) as WallpapersResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "wallpaper_fetch_failed");
      }

      setWallpapers(payload.wallpapers ?? []);
      setTruncated(Boolean(payload.truncated));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "wallpaper_fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void fetchWallpapers();
  }, [fetchWallpapers]);

  const selectedName = useMemo(
    () => wallpapers.find((item) => item.key === selectedKey)?.name ?? "기본 배경",
    [selectedKey, wallpapers],
  );

  return (
    <div className="space-y-3">
      <div className={cn(surface.card, "space-y-2 p-4 text-xs text-slate-600")}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-700">보드 배경 이미지</p>
            <p className="text-[11px] text-slate-500">R2(gom/assets/wallpaper)에서 불러온 이미지를 바로 미리보기할 수 있어요.</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            기본으로
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          현재 선택: <span className="font-semibold text-slate-700">{selectedName}</span>
        </p>
      </div>

      {loading ? <p className="text-[11px] text-slate-400">배경 이미지를 불러오는 중…</p> : null}
      {error ? (
        <div className={cn(surface.subtle, "space-y-2 p-3 text-[11px] text-amber-700")}>
          <p>이미지 목록을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => void fetchWallpapers()}
            className="rounded-md border border-amber-200 bg-white px-2.5 py-1 font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-2">
          {wallpapers.map((item) => {
            const active = selectedKey === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key, item.url)}
                className={cn(
                  "group overflow-hidden rounded-lg border bg-white text-left transition",
                  active ? "border-slate-900 ring-1 ring-slate-900/20" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <div className="aspect-[4/3] w-full bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={`${item.name} 배경`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="truncate text-[11px] font-semibold text-slate-700">{item.name}</p>
                  {active ? <span className="text-[10px] font-semibold text-slate-900">사용중</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {saveState === "saving" ? <p className="text-[10px] text-slate-400">배경 설정을 저장하는 중…</p> : null}
      {saveState === "error" ? <p className="text-[10px] text-rose-500">배경 저장에 실패했어요. 다시 선택해 주세요.</p> : null}
      {truncated ? <p className="text-[10px] text-slate-400">일부 이미지만 먼저 표시했어요.</p> : null}
    </div>
  );
}
