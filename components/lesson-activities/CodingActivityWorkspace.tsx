"use client";

import { useState, type KeyboardEventHandler, type ReactNode } from "react";

type Accent = "violet" | "cyan";

type Props = {
  testId: string;
  accent?: Accent;
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
  badges?: ReactNode;
  status?: ReactNode;
  alerts?: ReactNode;
  missionTitle?: string;
  mission?: ReactNode;
  missionDefaultOpen?: boolean;
  children: ReactNode;
  onKeyDownCapture?: KeyboardEventHandler<HTMLElement>;
};

const accentClasses: Record<
  Accent,
  {
    border: string;
    glow: string;
    eyebrow: string;
    mission: string;
    button: string;
  }
> = {
  violet: {
    border: "border-[var(--theme-border)]",
    glow: "shadow-[var(--theme-shadow)]",
    eyebrow: "text-[var(--theme-accent)]",
    mission: "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)]",
    button:
      "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)] hover:bg-[var(--theme-card-muted)]",
  },
  cyan: {
    border: "border-[var(--theme-border)]",
    glow: "shadow-[var(--theme-shadow)]",
    eyebrow: "text-[var(--theme-accent)]",
    mission: "border-[var(--theme-border)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)]",
    button:
      "border-[var(--theme-border)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/20",
  },
};

export default function CodingActivityWorkspace({
  testId,
  accent = "cyan",
  eyebrow,
  title,
  description,
  detail,
  badges,
  status,
  alerts,
  missionTitle = "미션",
  mission,
  missionDefaultOpen = true,
  children,
  onKeyDownCapture,
}: Props) {
  const [missionOpen, setMissionOpen] = useState(missionDefaultOpen);
  const [wideMode, setWideMode] = useState(false);
  const tone = accentClasses[accent];

  return (
    <section
      data-testid={testId}
      data-coding-workspace-shell="true"
      data-wide-mode={wideMode ? "true" : "false"}
      onKeyDownCapture={onKeyDownCapture}
      className={`pointer-events-auto mx-auto w-full min-w-0 max-w-[1680px] overflow-x-clip rounded-[1.75rem] border ${tone.border} bg-[var(--theme-surface)] text-[var(--theme-text)] ${tone.glow}`}
    >
      <div
        className={`flex min-w-0 flex-col gap-3 border-b border-[var(--theme-border)] px-3 py-3 sm:px-4 lg:flex-row lg:items-start lg:justify-between ${wideMode ? "xl:px-5" : "xl:px-6"}`}
      >
        <div className="min-w-0">
          <p
            className={`text-[11px] font-black uppercase tracking-[0.22em] ${tone.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--theme-text)] sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--theme-text-muted)]">
            {description}
          </p>
          {detail ? (
            <p className="mt-1 max-w-4xl text-xs leading-5 text-[var(--theme-text-muted)]">
              {detail}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {badges}
          <button
            type="button"
            onClick={() => {
              setWideMode((value) => !value);
              if (!wideMode) setMissionOpen(false);
            }}
            className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-black transition ${tone.button}`}
            aria-pressed={wideMode}
          >
            {wideMode ? "기본 보기" : "넓게 보기"}
          </button>
        </div>
      </div>

      <div
        className={`grid min-w-0 gap-3 px-3 py-3 sm:px-4 ${wideMode ? "xl:px-5" : "xl:px-6"}`}
      >
        {status}
        {alerts}
        {mission ? (
          <div
            className={`rounded-2xl border p-3 text-xs font-bold leading-5 ${tone.mission}`}
            data-testid="coding-workspace-mission-strip"
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="min-w-0 font-black">{missionTitle}</p>
              <button
                type="button"
                onClick={() => setMissionOpen((value) => !value)}
                className="shrink-0 rounded-lg border border-white/15 bg-[var(--theme-bg)]/30 px-2 py-1 text-[11px] font-black text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface)]"
                aria-expanded={missionOpen}
              >
                {missionOpen ? "미션 접기" : "미션 펼치기"}
              </button>
            </div>
            {missionOpen ? <div className="mt-2 min-w-0">{mission}</div> : null}
          </div>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
