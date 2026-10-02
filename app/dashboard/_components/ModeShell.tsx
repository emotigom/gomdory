"use client";

import type { ReactNode } from "react";

import { cn, pill } from "@/app/_components/uiTokens";
import PlanBadge from "./PlanBadge";
import { modeTheme } from "@/lib/ui/modeTheme";
import type { DashboardMode } from "../useDashboardMode";
import StorageUsageBadge from "@/components/StorageUsageBadge";

type ModeShellProps = {
  mode: DashboardMode;
  title: string;
  description: string;
  rightActions?: ReactNode;
  modeSwitcher?: ReactNode;
  children: ReactNode;
};

const modeLabels: Record<DashboardMode, string> = {
  clean: "수업 시작",
  focus: "수업 진행",
  manage: "보드 관리",
};

const modeHints: Record<DashboardMode, Array<{ key: string; label: string }>> = {
  clean: [
    { key: "1", label: "시작" },
    { key: "C", label: "보드" },
    { key: "N", label: "새 보드" },
    { key: "/", label: "검색" },
  ],
  focus: [
    { key: "2", label: "진행" },
    { key: "F", label: "집중" },
    { key: "H", label: "큰 화면" },
    { key: "Enter", label: "진행" },
  ],
  manage: [
    { key: "3", label: "관리" },
    { key: "M", label: "정리" },
    { key: "⌘/Ctrl+A", label: "전체 선택" },
    { key: "⌫", label: "선택 해제" },
  ],
};

export default function ModeShell({
  mode,
  title,
  description,
  rightActions,
  modeSwitcher,
  children,
}: ModeShellProps) {
  const theme = modeTheme[mode];

  return (
    <div
      className={cn("rounded-[28px] px-2 pb-10 pt-4", theme.shell)}
      data-testid="dashboard-root"
      data-mode={mode}
      data-mode-marker={mode}
      data-page-marker={`dashboard-${mode}`}
    >
      <div className={cn("sticky top-0 z-30 border-b backdrop-blur", theme.header)}>
        <div className={cn("mx-auto space-y-3 px-3", theme.container, theme.headerInner)}>
          <div className={cn("rounded-[24px] px-5 py-4 sm:px-7 sm:py-6", theme.banner)}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(pill.badge, theme.badge)}>{modeLabels[mode]}</span>
                  <span className="rounded-xl bg-[var(--theme-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--theme-text-muted)]">
                    큰 화면
                  </span>
                </div>
                <h1 className={cn("text-2xl font-semibold sm:text-4xl", theme.bannerTitle)}>{title}</h1>
                <p className={cn("text-sm font-medium sm:text-base", theme.bannerDescription)}>{description}</p>
                <div className={cn("flex flex-wrap items-center gap-2 text-xs font-semibold", theme.hintText)}>
                  {modeHints[mode].map((hint) => (
                    <div key={hint.key} className={cn("flex items-center gap-2 rounded-xl px-3 py-1", theme.hintPill)}>
                      <span className="rounded-md bg-[var(--theme-card)] px-2 py-0.5 text-[11px] font-bold text-[var(--theme-text)] shadow-sm">
                        {hint.key}
                      </span>
                      <span>{hint.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PlanBadge />
                <StorageUsageBadge />
                {rightActions ? <div className="flex flex-wrap items-center gap-2">{rightActions}</div> : null}
              </div>
            </div>
          </div>
          {modeSwitcher ? (
            <div className="rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-2">{modeSwitcher}</div>
          ) : null}
        </div>
        <div className={cn("h-1 w-full", theme.accent)} aria-hidden="true" />
      </div>
      <div className={cn("mx-auto w-full px-3 pt-6", theme.container)}>{children}</div>
    </div>
  );
}
