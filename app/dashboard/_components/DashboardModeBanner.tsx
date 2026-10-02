"use client";

import type { ReactNode } from "react";

import { cn, pill } from "@/app/_components/uiTokens";
import type { DashboardMode } from "../useDashboardMode";

const modeStyles: Record<DashboardMode, {
  frame: string;
  accent: string;
  icon: string;
  title: string;
  intent: string;
  badge: string;
  panel: string;
}> = {
  clean: {
    frame: "border-transparent bg-gradient-to-br from-emerald-600 via-sky-600 to-emerald-700 text-white shadow-sm",
    accent: "bg-sky-200",
    icon: "bg-white/15 text-white",
    title: "text-white",
    intent: "text-emerald-50",
    badge: "bg-white/15 text-white ring-1 ring-white/30",
    panel: "border-white/20 bg-white/10 text-white",
  },
  manage: {
    frame: "border-slate-200 bg-slate-900 text-white shadow-sm",
    accent: "bg-slate-300",
    icon: "bg-slate-700 text-white",
    title: "text-white",
    intent: "text-slate-200",
    badge: "bg-white/15 text-white ring-1 ring-white/20",
    panel: "border-slate-700/70 bg-slate-800/70 text-white",
  },
  focus: {
    frame: "border-indigo-800 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white shadow-sm",
    accent: "bg-violet-300",
    icon: "bg-violet-500 text-white",
    title: "text-white",
    intent: "text-indigo-100",
    badge: "bg-white/15 text-white ring-1 ring-white/20",
    panel: "border-indigo-700/60 bg-indigo-900/60 text-white",
  },
};

const modeLabels: Record<DashboardMode, string> = {
  clean: "CLEAN",
  manage: "MANAGE",
  focus: "FOCUS",
};

type DashboardModeBannerProps = {
  mode: DashboardMode;
  title: string;
  intent: string;
  icon: ReactNode;
  actions?: ReactNode;
  controls?: ReactNode;
  modeSwitcher?: ReactNode;
  rightSlot?: ReactNode;
  headline?: ReactNode;
};

export default function DashboardModeBanner({
  mode,
  title,
  intent,
  icon,
  actions,
  controls,
  modeSwitcher,
  rightSlot,
  headline,
}: DashboardModeBannerProps) {
  const style = modeStyles[mode];

  return (
    <div className={cn("sticky top-0 z-20 border-b backdrop-blur", style.frame)}>
      <div className={cn("h-1 w-full", style.accent)} aria-hidden="true" />
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl text-xl",
                style.icon,
              )}
              aria-hidden="true"
            >
              {icon}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={cn("text-xl font-semibold", style.title)}>{title}</h1>
                <span className={cn(pill.badge, style.badge)}>{modeLabels[mode]}</span>
              </div>
              <p className={cn("text-sm font-medium", style.intent)}>{intent}</p>
            </div>
          </div>
          {rightSlot ? <div className="flex flex-wrap items-center gap-2">{rightSlot}</div> : null}
        </div>
        {headline ? <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">{headline}</div> : null}
        {modeSwitcher}
        {actions ? (
          <div className={cn("rounded-3xl border p-3", style.panel)}>{actions}</div>
        ) : null}
        {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
      </div>
    </div>
  );
}
