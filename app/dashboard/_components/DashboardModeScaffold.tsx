"use client";

import type { ReactNode } from "react";

import { cn } from "@/app/_components/uiTokens";
import { dashboardModeTokens } from "../styles";
import type { DashboardMode } from "../useDashboardMode";

type DashboardModeScaffoldProps = {
  mode: DashboardMode;
  header: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
};

const layoutByMode: Record<DashboardMode, { wrap: string; grid: string }> = {
  clean: {
    wrap: "max-w-6xl space-y-6",
    grid: "space-y-6",
  },
  focus: {
    wrap: "max-w-6xl",
    grid: "grid gap-6 lg:grid-cols-[1.6fr_1fr]",
  },
  manage: {
    wrap: "max-w-6xl",
    grid: "grid gap-6 xl:grid-cols-[1.4fr_1fr]",
  },
};

export default function DashboardModeScaffold({
  mode,
  header,
  primary,
  secondary,
}: DashboardModeScaffoldProps) {
  const modeTokens = dashboardModeTokens[mode];
  const layout = layoutByMode[mode];

  return (
    <div
      className={cn("rounded-[28px] px-2 pb-10 pt-4", modeTokens.shell, modeTokens.spacing)}
      data-testid="dashboard-root"
      data-mode={mode}
      data-mode-marker={mode}
    >
      {header}
      <div className={cn("mx-auto w-full px-3", layout.wrap)}>
        <div className={layout.grid}>
          <div className="space-y-4">{primary}</div>
          {secondary ? <div className="space-y-4">{secondary}</div> : null}
        </div>
      </div>
    </div>
  );
}
