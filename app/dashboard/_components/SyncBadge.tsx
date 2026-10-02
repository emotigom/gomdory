"use client";

import { cn } from "@/app/_components/uiTokens";

type SyncState = "synced" | "syncing" | "failed";

type SyncBadgeProps = {
  online: boolean;
  syncState: SyncState;
  lastSyncError?: string;
  showInvalidation?: boolean;
  invalidationLabel?: string;
  labelOverride?: string;
  onClick?: () => void;
  onRetry?: () => void;
};

const toneByState = {
  offline: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
  synced: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80",
  syncing: "bg-sky-50 text-sky-700 ring-1 ring-sky-100/80",
  failed: "bg-red-50 text-red-700 ring-1 ring-red-100/80",
  invalidation: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/80",
};

export default function SyncBadge({
  online,
  syncState,
  lastSyncError,
  showInvalidation = false,
  invalidationLabel,
  labelOverride,
  onClick,
  onRetry,
}: SyncBadgeProps) {
  const stateTone = !online
    ? toneByState.offline
    : showInvalidation
      ? toneByState.invalidation
      : syncState === "synced"
        ? toneByState.synced
        : syncState === "syncing"
          ? toneByState.syncing
          : toneByState.failed;

  const baseLabel = !online
    ? "오프라인"
    : showInvalidation
      ? invalidationLabel ?? "다른 탭에서 변경 감지됨"
      : syncState === "synced"
        ? "최신"
        : syncState === "syncing"
          ? "동기화중…"
          : "동기화 실패";
  const label = labelOverride ?? baseLabel;
  const tooltip = online && syncState === "failed" && lastSyncError ? lastSyncError : undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold",
        stateTone,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        title={tooltip}
        data-interactive="true"
        className="flex items-center gap-2"
      >
        <span>{label}</span>
      </button>
      {online && syncState === "failed" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          data-interactive="true"
          className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-100/80 transition hover:bg-white"
        >
          재시도
        </button>
      ) : null}
    </div>
  );
}
