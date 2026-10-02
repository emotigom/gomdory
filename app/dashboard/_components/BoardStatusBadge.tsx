"use client";

import { cn, pill } from "@/app/_components/uiTokens";

export type BoardStatus = "idle" | "syncing" | "failed";

type BoardStatusBadgeProps = {
  status?: BoardStatus;
  actionLabel?: string;
  onAction?: () => void;
};

export default function BoardStatusBadge({ status = "idle", actionLabel, onAction }: BoardStatusBadgeProps) {
  if (status === "idle") return null;

  if (status === "syncing") {
    return (
      <span
        className={cn(
          pill.badge,
          "inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 ring-1 ring-sky-100/80",
        )}
      >
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        </span>
        반영중
      </span>
    );
  }

  return (
    <span
      className={cn(
        pill.badge,
        "inline-flex items-center gap-2 bg-rose-50 text-rose-700 ring-1 ring-rose-100/80",
      )}
    >
      실패
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100/80"
        >
          {actionLabel}
        </button>
      ) : null}
    </span>
  );
}
