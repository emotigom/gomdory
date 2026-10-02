import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/app/_components/uiTokens";

import { DashboardHintsCoachmark, DashboardInlineHint } from "./DashboardUxHints";

type Task = { label: string; href?: string };

export default function DashboardPurposeHeader({
  eyebrow,
  title,
  description,
  nextAction,
  statusHint,
  rightSlot,
  hintsEnabled = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  nextAction: Task;
  statusHint: string;
  rightSlot?: ReactNode;
  hintsEnabled?: boolean;
}) {
  return (
    <header className="space-y-4 border-b border-[var(--ui-border)] pb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brown)]">{eyebrow}</p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--ui-ink)]">{title}</h1>
          <p className="max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        {rightSlot}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">다음 행동</span>
        {nextAction.href ? (
          <Link
            href={nextAction.href}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-slate-500 hover:bg-slate-50",
            )}
            aria-label={`다음 행동: ${nextAction.label}`}
          >
            <span aria-hidden>→</span>
            <span>{nextAction.label}</span>
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800">
            <span aria-hidden>→</span>
            <span>{nextAction.label}</span>
          </span>
        )}
        {hintsEnabled ? <DashboardInlineHint text="지금 화면에서 가장 먼저 할 일을 짧게 보여줍니다." /> : null}
      </div>
      <p className="text-xs text-slate-500">
        상태 힌트 · {statusHint}
        {hintsEnabled ? <span className="ml-2 inline-flex"><DashboardInlineHint text="상태 힌트는 현재 화면의 우선순위를 짧게 보여줍니다." /></span> : null}
      </p>
      {hintsEnabled ? <DashboardHintsCoachmark /> : null}
    </header>
  );
}
