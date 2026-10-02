"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { ShareBoard, ShareWall } from "@/lib/data/share";
import type { StudentDefaultView } from "@/lib/data/boardShareSettingsShared";
import InlineAlert from "@/app/_components/InlineAlert";

import StudentFeedView from "./feed/StudentFeedView";

type StudentEntryRouterProps = {
  board: ShareBoard;
  walls: ShareWall[];
  shareCode: string;
  serverDefaultView: StudentDefaultView;
};

type StudentLegacyMode = "feed" | "walls";

function parseLegacyMode(value: string | null): StudentLegacyMode | null {
  const normalized = value?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "feed" || normalized === "stream") return "feed";
  if (normalized === "walls" || normalized === "gallery" || normalized === "columns" || normalized === "grid") {
    return "walls";
  }
  return null;
}

function mapDefaultToLegacy(view: StudentDefaultView | null): StudentLegacyMode {
  if (view === "stream") return "feed";
  return "walls";
}

export default function StudentEntryRouter({
  board,
  walls,
  shareCode,
  serverDefaultView,
}: StudentEntryRouterProps) {
  const searchParams = useSearchParams();
  const [resolvedMode, setResolvedMode] = useState<StudentLegacyMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storageKey = useMemo(() => `studentViewMode:${shareCode}`, [shareCode]);
  const queryView = parseLegacyMode(searchParams.get("view"));

  useEffect(() => {
    const resolve = () => {
      try {
        const storedView = parseLegacyMode(
          typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null,
        );
        const priorityView = queryView ?? storedView ?? mapDefaultToLegacy(serverDefaultView ?? null) ?? "feed";

        const fallback = priorityView === "walls" ? "walls" : "feed";
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, fallback);
        }
        setResolvedMode(fallback);
      } catch (resolutionError) {
        const message =
          resolutionError instanceof Error ? resolutionError.message : "보기 모드를 선택하지 못했습니다.";
        setError(message);
      }
    };

    resolve();
  }, [queryView, shareCode, serverDefaultView, storageKey]);

  if (error) {
    return (
      <InlineAlert
        tone="error"
        title="기본 화면을 불러오지 못했습니다."
        description={error}
        action={
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            닫기
          </button>
        }
      />
    );
  }

  if (!resolvedMode) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded-md bg-gray-200" />
        <div className="mt-3 h-24 animate-pulse rounded-md bg-gray-100" />
      </div>
    );
  }

  return (
    <StudentFeedView
      board={board}
      walls={walls}
      shareCode={shareCode}
      initialMode={resolvedMode}
      serverDefaultView={serverDefaultView}
    />
  );
}
