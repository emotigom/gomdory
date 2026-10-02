"use client";

import { useState, type ComponentProps } from "react";

import StudentActivityPanel, {
  type StudentActiveLesson,
} from "@/components/lesson-activities/StudentActivityPanel";
import ThemeSelector from "@/components/theme/ThemeSelector";
import StudentBoardMinimal from "./StudentBoardMinimal";

type StudentBoardMinimalProps = ComponentProps<typeof StudentBoardMinimal>;

type Props = {
  activeLesson: StudentActiveLesson;
  board: StudentBoardMinimalProps;
};

export default function StudentLessonWorkspace({ activeLesson, board }: Props) {
  const [activeTab, setActiveTab] = useState<"activity" | "board">("activity");
  const displayName = board.viewerName?.trim() || "게스트";

  return (
    <div
      data-page-marker="student-lesson-workspace"
      data-testid="student-lesson-workspace"
      className="min-h-screen overflow-x-clip bg-[var(--theme-bg)] text-[var(--theme-text)]"
    >
      <header className="sticky top-0 z-40 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3 shadow-[var(--theme-shadow)] backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">
              오늘의 수업
            </p>
            <h1 className="mt-1 truncate text-xl font-black tracking-[-0.03em] text-[var(--theme-text)] sm:text-2xl">
              {activeLesson.title}
            </h1>
            <p className="mt-1 truncate text-xs font-semibold text-[var(--theme-text-muted)]">
              {board.title} · {displayName}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ThemeSelector compact label="교실 테마" />
          <nav
            className="flex shrink-0 gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-1"
            aria-label="학생 화면 보기 전환"
          >
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === "activity" ? "bg-[var(--theme-accent)] text-[var(--theme-accent-text)] ring-4 ring-[var(--theme-focus)]" : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-muted)]"}`}
              aria-pressed={activeTab === "activity"}
            >
              실습
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("board")}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === "board" ? "bg-[var(--theme-accent)] text-[var(--theme-accent-text)] ring-4 ring-[var(--theme-focus)]" : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-muted)]"}`}
              aria-pressed={activeTab === "board"}
            >
              보드 보기
            </button>
          </nav>
          </div>
        </div>
      </header>

      {activeTab === "activity" ? (
        <main
          className="mx-auto w-full max-w-[1680px] px-3 py-5 sm:px-6 lg:px-8"
          data-testid="student-lesson-activity-main"
        >
          <StudentActivityPanel
            activeLesson={activeLesson}
            shareCode={board.shareCode}
            displayName={board.viewerName}
            onOpenBoard={() => setActiveTab("board")}
          />
        </main>
      ) : (
        <main className="min-w-0" data-testid="student-lesson-board-tab">
          <StudentBoardMinimal {...board} />
        </main>
      )}
    </div>
  );
}
