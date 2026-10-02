import type { DashboardMode } from "./useDashboardMode";

export const dashboardModeTokens: Record<
  DashboardMode,
  {
    shell: string;
    spacing: string;
    headline: string;
  }
> = {
  clean: {
    shell:
      "bg-transparent text-[var(--theme-text)] [--dashboard-accent:#087f75]",
    spacing: "space-y-6 sm:space-y-8 text-[15px] sm:text-base",
    headline: "text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--theme-text)]",
  },
  manage: {
    shell:
      "bg-transparent text-[var(--theme-text)] [--dashboard-accent:#a84a05]",
    spacing: "space-y-5 text-sm sm:text-[15px]",
    headline: "text-2xl font-semibold text-[var(--theme-text)]",
  },
  focus: {
    shell:
      "bg-transparent text-[var(--theme-text)] [--dashboard-accent:#3157d5]",
    spacing: "space-y-6 sm:space-y-7 text-[15px] sm:text-base",
    headline: "text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--theme-text)]",
  },
};
