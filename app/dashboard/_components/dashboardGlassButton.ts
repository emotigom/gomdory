import { cn } from "@/app/_components/uiTokens";

const base = "dashboard-glass-button inline-flex items-center justify-center gap-2 rounded-[var(--ui-radius-sm)] border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "border-[var(--theme-accent-strong)] bg-[var(--theme-accent)] px-4 py-2.5 text-[var(--theme-accent-text)] shadow-[0_14px_28px_-20px_rgba(49,87,213,0.72)] hover:bg-[var(--theme-accent-strong)]",
  secondary: "border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2.5 text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-muted)]",
  ghost: "border-[var(--theme-border)] bg-transparent px-4 py-2.5 text-[var(--theme-text-muted)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-muted)] hover:text-[var(--theme-text)]",
  selected: "border-[var(--theme-accent)] bg-[var(--theme-surface-muted)] px-4 py-2.5 text-[var(--theme-accent-strong)] shadow-[0_10px_26px_-20px_rgba(49,87,213,0.5)]",
  danger: "border-[var(--theme-danger)] bg-[var(--theme-danger)] px-4 py-2.5 text-white hover:brightness-95",
  icon: "h-11 w-11 border-[var(--theme-border)] bg-[var(--theme-card)] px-0 text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-muted)]",
} as const;

export type DashboardGlassButtonVariant = keyof typeof variants;

export function dashboardGlassButtonClass(variant: DashboardGlassButtonVariant, className?: string) {
  return cn(base, variants[variant], className);
}
