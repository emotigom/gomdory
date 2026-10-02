"use client";

import { useMemo, useRef } from "react";

import useDismissableLayer from "@/app/_components/useDismissableLayer";
import { buttonTone, cn, surface } from "@/app/_components/uiTokens";

import type { RecentOp } from "../useDashboardBoards";

type SyncState = "synced" | "syncing" | "failed";

type SyncCenterProps = {
  isOpen: boolean;
  online: boolean;
  syncState: SyncState;
  lastSyncAt?: number;
  lastSyncError?: string;
  recentOps: RecentOp[];
  onRefresh: () => void;
  onClose: () => void;
  onClearError?: () => void;
};

const statusLabels: Record<SyncState, string> = {
  synced: "반영됨",
  syncing: "동기화중…",
  failed: "동기화 실패",
};

const opStatusLabels: Record<RecentOp["status"], string> = {
  pending: "진행 중",
  ok: "완료",
  fail: "실패",
};

const opStatusTone: Record<RecentOp["status"], string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/80",
  ok: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80",
  fail: "bg-rose-50 text-rose-700 ring-1 ring-rose-100/80",
};

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

export default function SyncCenter({
  isOpen,
  online,
  syncState,
  lastSyncAt,
  lastSyncError,
  recentOps,
  onRefresh,
  onClose,
  onClearError,
}: SyncCenterProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useDismissableLayer({
    isOpen,
    setIsOpen: (next) => {
      if (!next) onClose();
    },
    layerRef,
  });

  const statusText = online ? statusLabels[syncState] : "오프라인";
  const relativeSync = lastSyncAt ? formatRelativeTime(lastSyncAt) : null;
  const recentDisplay = useMemo(() => recentOps.slice(0, 20), [recentOps]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        ref={layerRef}
        className={cn("w-full max-w-lg space-y-4 p-5", surface.overlay)}
        role="dialog"
        aria-modal="true"
        aria-label="동기화 센터"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">동기화</h2>
          <button
            type="button"
            onClick={onClose}
            data-interactive="true"
            className={buttonTone("ghost", { size: "sm", muted: true })}
          >
            닫기
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">상태</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                online
                  ? syncState === "synced"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80"
                    : syncState === "syncing"
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-100/80"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-100/80"
                  : "bg-slate-100 text-slate-700 ring-1 ring-slate-200/70",
              )}
            >
              {statusText}
            </span>
            {relativeSync ? (
              <span className="text-[12px] font-medium text-gray-600">마지막 반영: {relativeSync}</span>
            ) : (
              <span className="text-[12px] font-medium text-gray-500">아직 반영 기록이 없어요</span>
            )}
          </div>
          {lastSyncError ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <span>최근 오류: {lastSyncError}</span>
              {onClearError ? (
                <button
                  type="button"
                  onClick={onClearError}
                  className="text-[11px] font-semibold text-rose-700 underline underline-offset-4"
                >
                  지우기
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">최근 작업</p>
            <span className="text-[11px] text-gray-400">{recentDisplay.length}/20</span>
          </div>
          <div className="mt-2 space-y-2">
            {recentDisplay.length === 0 ? (
              <p className="text-xs text-gray-500">최근 작업이 없습니다.</p>
            ) : (
              recentDisplay.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-800">{entry.label}</span>
                    <span className="text-[11px] text-gray-500">{formatRelativeTime(entry.at)}</span>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", opStatusTone[entry.status])}>
                    {opStatusLabels[entry.status]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={!online}
          className={buttonTone("primary", { tone: "emerald" })}
        >
          지금 새로고침
        </button>
        {!online ? (
          <p className="text-[11px] text-gray-500">오프라인에서는 새로고침이 대기합니다.</p>
        ) : null}
      </div>
    </div>
  );
}
