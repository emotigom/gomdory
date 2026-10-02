import type { ReactNode } from "react";

export type EduBadgeProps = {
  variant?: "brand" | "progress" | "done";
  children: ReactNode;
};

const variantStyles: Record<NonNullable<EduBadgeProps["variant"]>, string> = {
  brand: "border-sky-200/70 bg-white/80 text-sky-700",
  progress: "border-slate-200/80 bg-white/80 text-slate-600",
  done: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700",
};

export default function EduBadge({ variant = "progress", children }: EduBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        variantStyles[variant]
      }`}
    >
      {children}
    </span>
  );
}
