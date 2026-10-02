"use client";

import { useId } from "react";

import { useTheme } from "@/app/_components/ThemeProvider";
import { GOM_THEME_OPTIONS, type ThemeId } from "@/lib/theme/theme";

type Props = {
  compact?: boolean;
  label?: string;
  className?: string;
};

export default function ThemeSelector({ compact = false, label = "화면 테마", className }: Props) {
  const id = useId();
  const { theme, setTheme } = useTheme();

  return (
    <label className={`theme-card inline-flex min-w-0 flex-col gap-1.5 rounded-2xl p-2 text-xs font-bold text-[var(--theme-text)] ${className ?? ""}`} htmlFor={id}>
      <span className="px-1 text-[11px] font-bold text-[var(--theme-text-muted)]">{label}</span>
      <select
        id={id}
        value={theme}
        onChange={(event) => setTheme(event.currentTarget.value as ThemeId)}
        className="theme-focus-ring min-h-[var(--theme-control-height)] rounded-xl border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-2 text-sm font-black text-[var(--theme-text)] shadow-sm outline-none"
        aria-label={label}
      >
        {GOM_THEME_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {compact ? option.shortLabel : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
