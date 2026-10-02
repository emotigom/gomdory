import type { ReactNode } from "react";
import { cn } from "@/app/_components/uiTokens";

type StudentSurfaceProps = {
  variant?: "calm";
  children: ReactNode;
  className?: string;
};

const variantStyles: Record<NonNullable<StudentSurfaceProps["variant"]>, string> = {
  calm:
    "bg-[var(--surface-bg)] text-slate-900",
};

export default function StudentSurface({ variant = "calm", children, className }: StudentSurfaceProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", variantStyles[variant], className)} data-student-surface>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.28),transparent_70%)] blur-3xl" />
        <div className="absolute -top-10 right-[-12%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.2),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.18),transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.06)_45%,rgba(15,23,42,0.12)_100%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:16px_16px]" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
