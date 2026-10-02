"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

import BoardDesignPanel from "@/app/dashboard/boards/[boardId]/board/_components/BoardDesignPanel";
import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

type SaveState = "idle" | "saving" | "error";

type BoardWallpaperSettingsClientProps = {
  boardId: string;
  initialWallpaperKey: string | null;
  initialWallpaperUrl: string | null;
};

function buildPreviewStyle(url: string | null): CSSProperties | undefined {
  if (!url) return undefined;

  return {
    backgroundImage: `linear-gradient(to bottom, rgba(2, 6, 23, 0.28), rgba(2, 6, 23, 0.72)), url(${JSON.stringify(url)})`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };
}

export default function BoardWallpaperSettingsClient({
  boardId,
  initialWallpaperKey,
  initialWallpaperUrl,
}: BoardWallpaperSettingsClientProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(initialWallpaperKey);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialWallpaperUrl);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function saveWallpaper(nextKey: string | null, nextUrl: string | null) {
    const previousKey = selectedKey;
    const previousUrl = previewUrl;

    setSelectedKey(nextKey);
    setPreviewUrl(nextUrl);
    setSaveState("saving");

    try {
      const response = await apiFetch(apiV1Path(`boards/${boardId}/settings`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined,
          patch: { wallpaperKey: nextKey },
        }),
      });

      if (!response.ok) {
        throw new Error("wallpaper_save_failed");
      }

      setSaveState("idle");
    } catch (error) {
      console.error("[board-wallpaper-settings] save failed", error);
      setSelectedKey(previousKey);
      setPreviewUrl(previousUrl);
      setSaveState("error");
    }
  }

  return (
    <section className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--theme-text)]">보드 배경</h2>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
            R2에 준비된 배경 이미지를 선택하면 보드 소유자 화면과 게스트 공유 화면에 함께 적용됩니다.
          </p>
          <div className="mt-4">
            <BoardDesignPanel
              boardId={boardId}
              selectedKey={selectedKey}
              onSelect={(key, url) => void saveWallpaper(key, url)}
              onReset={() => void saveWallpaper(null, null)}
              saveState={saveState}
            />
          </div>
        </div>
        <div className="w-full shrink-0 lg:w-72">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-text-muted)]">미리보기</p>
          <div
            className="mt-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-center text-xs font-medium text-[var(--theme-text-muted)] shadow-inner"
            style={buildPreviewStyle(previewUrl)}
          >
            {previewUrl ? <span className="rounded-full bg-slate-950/70 px-3 py-1.5 text-cyan-50">현재 보드 배경</span> : "기본 배경"}
          </div>
          {saveState === "error" ? (
            <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              배경 저장에 실패했습니다. 다시 선택해주세요.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
