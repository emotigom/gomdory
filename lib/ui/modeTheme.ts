export type DashboardModeTheme = {
  shell: string;
  header: string;
  headerInner: string;
  banner: string;
  bannerTitle: string;
  bannerDescription: string;
  badge: string;
  title: string;
  description: string;
  section: string;
  accent: string;
  container: string;
  hintPill: string;
  hintText: string;
};

export type DashboardModeKey = "clean" | "focus" | "manage";

export const modeTheme: Record<DashboardModeKey, DashboardModeTheme> = {
  clean: {
    shell:
      "bg-transparent text-[var(--theme-text)] [--dashboard-accent:#087f75] [--dashboard-card-radius:24px] [--dashboard-card-shadow:0_28px_80px_-60px_rgba(8,127,117,0.3)] [--dashboard-card-shadow-subtle:0_20px_60px_-50px_rgba(8,127,117,0.22)]",
    header: "border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-text)]",
    headerInner: "py-7",
    banner: "border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-[var(--dashboard-card-shadow)]",
    bannerTitle: "text-[var(--theme-text)]",
    bannerDescription: "text-[var(--theme-text-muted)]",
    badge: "bg-[#087f75] text-white",
    title: "text-[var(--theme-text)]",
    description: "text-[var(--theme-text-muted)]",
    section: "border-[var(--theme-border)] bg-[var(--theme-card)]",
    accent: "bg-[#087f75]",
    container: "max-w-6xl",
    hintPill: "bg-[#e4f6f2] text-[#12655e] ring-1 ring-[#b8e2d9]",
    hintText: "text-[var(--theme-text-muted)]",
  },
  focus: {
    shell:
      "bg-transparent text-[var(--theme-text)] [--dashboard-accent:#3157d5] [--dashboard-card-radius:22px] [--dashboard-card-shadow:0_30px_86px_-62px_rgba(49,87,213,0.38)] [--dashboard-card-shadow-subtle:0_22px_64px_-52px_rgba(49,87,213,0.28)] [--dashboard-sticky-top:132px]",
    header: "border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-text)]",
    headerInner: "py-5",
    banner: "border border-[var(--theme-border)] bg-[linear-gradient(135deg,#ffffff,#eef2ff)] shadow-[var(--dashboard-card-shadow)]",
    bannerTitle: "text-[var(--theme-text)]",
    bannerDescription: "text-[var(--theme-text-muted)]",
    badge: "bg-[#3157d5] text-white",
    title: "text-[var(--theme-text)]",
    description: "text-[var(--theme-text-muted)]",
    section: "border-[var(--theme-border)] bg-[var(--theme-card)]",
    accent: "bg-[#3157d5]",
    container: "max-w-7xl",
    hintPill: "bg-[#e7edff] text-[#2949b4] ring-1 ring-[#c8d3ff]",
    hintText: "text-[var(--theme-text-muted)]",
  },
  manage: {
    shell:
      "bg-transparent text-[var(--theme-text)] [--dashboard-accent:#a84a05] [--dashboard-card-radius:18px] [--dashboard-card-shadow:0_24px_72px_-56px_rgba(87,54,22,0.26)] [--dashboard-card-shadow-subtle:0_18px_54px_-46px_rgba(87,54,22,0.2)] [--dashboard-sticky-top:116px]",
    header: "border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-text)]",
    headerInner: "py-4",
    banner: "border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-[var(--dashboard-card-shadow)]",
    bannerTitle: "text-[var(--theme-text)]",
    bannerDescription: "text-[var(--theme-text-muted)]",
    badge: "bg-[#a84a05] text-white",
    title: "text-[var(--theme-text)]",
    description: "text-[var(--theme-text-muted)]",
    section: "border-[var(--theme-border)] bg-[var(--theme-card)]",
    accent: "bg-[#a84a05]",
    container: "max-w-7xl",
    hintPill: "bg-[#fff0df] text-[#8a410d] ring-1 ring-[#f1cfaa]",
    hintText: "text-[var(--theme-text-muted)]",
  },
};
