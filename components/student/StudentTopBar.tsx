"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/app/_components/uiTokens";
import { normalizeViewerName, truncateViewerName } from "@/lib/share/normalizeViewerName";
import { exitFullscreen, getFullscreenElement, requestFullscreen } from "@/lib/ui/fullscreen";
import { STUDENT_VIEWS, type StudentView } from "@/lib/student/view";

type StudentTopBarProps = {
  shareCode: string;
  view: StudentView;
  onViewChange: (view: StudentView) => void;
};

const VIEW_LABELS: Record<StudentView, string> = {
  wall: "Wall",
  gallery: "갤러리",
  columns: "컬럼",
  stream: "스트림",
};

function readCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[-[\]{}()*+?.,\\^$|#\\s]/g, "\\$&")}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1] ?? "") : "";
}

export default function StudentTopBar({ shareCode, view, onViewChange }: StudentTopBarProps) {
  const searchParams = useSearchParams();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTvPrompt, setShowTvPrompt] = useState(false);
  const rawViewer = readCookieValue("gomdori_student_name");
  const normalizedViewer = useMemo(() => normalizeViewerName(rawViewer), [rawViewer]);
  const displayViewer = useMemo(
    () => truncateViewerName(normalizedViewer),
    [normalizedViewer],
  );

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(getFullscreenElement()));
    update();
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update as EventListener);
    };
  }, []);

  useEffect(() => {
    const tvQuery = searchParams.get("tv") === "1";
    if (tvQuery && !isFullscreen) {
      setShowTvPrompt(true);
      return;
    }
    setShowTvPrompt(false);
  }, [isFullscreen, searchParams]);

  const viewOptions = useMemo(() => STUDENT_VIEWS, []);

  const handleFullscreenToggle = async () => {
    if (isFullscreen) {
      await exitFullscreen();
      return;
    }
    await requestFullscreen();
  };

  return (
    <div className="space-y-3">
      {showTvPrompt ? (
        <div className="student-topbar-shell rounded-[20px] border px-4 py-3 text-sm shadow-sm">
          TV 모드로 실행 중이에요. 전체화면을 켜면 더 선명하게 보여요.
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="student-topbar-pill ml-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition"
          >
            전체화면 켜기
          </button>
        </div>
      ) : null}
      <div className="student-topbar-shell flex flex-wrap items-center justify-between gap-4 rounded-[28px] border p-5 shadow-[0_24px_120px_-80px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="space-y-1">
          <p className="student-topbar-muted text-xs font-semibold uppercase tracking-[0.32em]">Class Share</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-2xl font-semibold">대화명</div>
            <span
              className="max-w-[220px] truncate text-2xl font-semibold"
              title={normalizedViewer}
            >
              {displayViewer}
            </span>
          </div>
          <p className="student-topbar-muted text-sm">학생 공유 갤러리</p>
        </div>

        <div
          className="student-topbar-menu flex flex-wrap items-center gap-2 rounded-2xl border p-2"
          role="tablist"
          aria-label="보기 전환"
        >
          {viewOptions.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => onViewChange(key)}
              className={cn(
                "flex min-h-[44px] items-center justify-center rounded-xl px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]",
                view === key
                  ? "student-topbar-tab-active shadow-[0_16px_80px_-60px_rgba(79,70,229,0.55)] ring-1"
                  : "student-topbar-tab ring-1 ring-transparent",
              )}
            >
              {VIEW_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="student-topbar-pill inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 text-sm font-semibold transition"
          >
            {isFullscreen ? "전체화면 종료" : "전체화면"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="student-topbar-pill inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 text-sm font-semibold transition"
          >
            새로고침
          </button>
          <Link
            href={`/?code=${shareCode}`}
            className="student-topbar-pill inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 text-sm font-semibold transition"
          >
            도움말
          </Link>
        </div>
      </div>
    </div>
  );
}
