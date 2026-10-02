type StudentStatusBarProps = {
  title: string;
  writeLocked: boolean;
  writeLockedReason?: "share_locked" | "class_ended" | "turnstile_required" | null;
  statusLabel?: string;
  statusTone?: "live" | "reconnecting" | "connecting" | "offline";
  hint?: string | null;
  compact?: boolean;
  className?: string;
};

import { cn, pill } from "@/app/_components/uiTokens";
import { WRITE_LOCK_COPY } from "@/lib/student/writeLockReason";

const statusToneStyles: Record<NonNullable<StudentStatusBarProps["statusTone"]>, string> = {
  live: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
  reconnecting: "border-amber-100 bg-amber-50/80 text-amber-700",
  connecting: "border-gray-100 bg-gray-50/80 text-gray-700",
  offline: "border-rose-100 bg-rose-50/80 text-rose-700",
};

export default function StudentStatusBar({
  title,
  writeLocked,
  writeLockedReason = null,
  statusLabel,
  statusTone = "connecting",
  hint,
  compact = false,
  className,
}: StudentStatusBarProps) {
  const lockCopy = writeLockedReason ? WRITE_LOCK_COPY[writeLockedReason] : null;
  const lockBadge = lockCopy?.badge ?? "읽기 전용";
  const lockMessage = lockCopy?.message ?? "선생님이 잠금을 해제하면 작성할 수 있어요.";

  return (
    <div
      className={`student-status-bar border-b border-gray-100 bg-white/80 px-4 text-xs text-gray-700 backdrop-blur ${compact ? "py-1" : "py-1.5"} ${className ?? ""}`}
    >
      <div className={`mx-auto flex w-full max-w-[1200px] flex-col md:flex-row md:items-center md:justify-between ${compact ? "gap-1.5" : "gap-2"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`max-w-[240px] truncate font-semibold text-gray-900 md:max-w-[360px] ${compact ? "text-[12px]" : ""}`}
            title={title}
          >
            {title}
          </span>
          <span
            className={cn(
              pill.badge,
              writeLocked
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            {writeLocked ? lockBadge : "작성 가능"}
          </span>
          {statusLabel ? (
            <span
              className={cn(pill.badge, statusToneStyles[statusTone])}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
        {writeLocked ? (
          <p className="text-[11px] text-gray-500 md:text-xs">
            {hint ?? lockMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
