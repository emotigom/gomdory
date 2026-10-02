"use client";

import Link from "next/link";
import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn, pill } from "@/app/_components/uiTokens";
import type { DashboardBoardSummary } from "@/lib/data/boards";

import BoardStatusBadge, { type BoardStatus } from "./BoardStatusBadge";
const labelPillClass = cn(
  pill.badge,
  "bg-slate-900 text-white shadow-[0_10px_50px_-32px_rgba(15,23,42,0.45)]",
);

type BoardTileManageProps = {
  board: DashboardBoardSummary;
  pinned?: boolean;
  recent?: boolean;
  selected?: boolean;
  onSelect: (boardId: string) => void;
  onPin: (boardId: string) => void;
  onUnpin: (boardId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDeleteConfirm: () => void;
  status?: BoardStatus;
  statusActionLabel?: string;
  onStatusAction?: () => void;
};

export default function BoardTileManage({
  board,
  pinned,
  recent,
  selected,
  onSelect,
  onPin,
  onUnpin,
  onMoveUp,
  onMoveDown,
  onDeleteConfirm,
  status,
  statusActionLabel,
  onStatusAction,
}: BoardTileManageProps) {
  const boardId = board.boardId;
  const isTempBoard = Boolean(boardId && boardId.startsWith("temp:"));
  const optimistic = Boolean((board as { __optimistic?: boolean }).__optimistic);
  const isReady = Boolean(boardId) && !isTempBoard;
  const canSelect = Boolean(boardId) && !isTempBoard;
  const shareLabel = board.shareEnabled && board.shareCode ? "ON" : "OFF";

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <CardTile
      className={cn(
        "relative overflow-hidden",
        selected ? "ring-2 ring-emerald-200 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]" : "",
      )}
      data-board-id={boardId}
      data-dashboard-tile="manage"
      role="presentation"
      aria-disabled="true"
    >
      {boardId ? (
        <label className="absolute left-3 top-3 z-20 flex min-h-[44px] items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => {
              if (canSelect && boardId) {
                onSelect(boardId);
              }
            }}
            disabled={!canSelect}
            className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            data-interactive="true"
          />
          선택
        </label>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{board.title}</h3>
          {optimistic && status !== "failed" ? (
            <span className={cn(pill.badge, "bg-amber-50 text-amber-700 ring-1 ring-amber-100/80")}>생성중…</span>
          ) : null}
          {pinned ? (
            <span className={cn(pill.badge, "bg-amber-50 text-amber-800 ring-1 ring-amber-100/80")}>PIN</span>
          ) : null}
          {recent ? (
            <span className={cn(pill.badge, "bg-sky-50 text-sky-800 ring-1 ring-sky-100/90")}>최근</span>
          ) : null}
          <BoardStatusBadge status={status} actionLabel={statusActionLabel} onAction={onStatusAction} />
        </div>
        <p className="text-sm text-gray-700 line-clamp-2">
          {board.description ?? "최근 카드/첨부 미리보기를 준비 중입니다."}
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <span>
            {board.created_at ? new Date(board.created_at).toLocaleDateString("ko-KR") : "-"}
          </span>
          <span aria-hidden>•</span>
          <span>{board.board_view_type === "wall" ? "담벼락" : "그리드"} 보드</span>
          <span aria-hidden>•</span>
          <span>공유 {shareLabel}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={isReady ? `/dashboard/boards/${boardId}/edit` : "#"}
          aria-disabled={!isReady}
          data-interactive="true"
          className={cn(buttonTone("secondary", { size: "sm" }), !isReady ? "pointer-events-none opacity-60" : "")}
        >
          수정
        </Link>
        <button
          type="button"
          disabled={!isReady || optimistic}
          data-interactive="true"
          onClick={onDeleteConfirm}
          className={cn(
            buttonTone("secondary", { size: "sm" }),
            "border-red-200 text-red-600 hover:bg-red-50",
            !isReady || optimistic ? "pointer-events-none opacity-60" : "",
          )}
        >
          삭제
        </button>
        {isReady ? (
          <>
            {pinned ? (
              <button
                type="button"
                onClick={() => onUnpin(boardId)}
                data-interactive="true"
                className={buttonTone("secondary", { size: "sm" })}
              >
                핀 해제
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPin(boardId)}
                data-interactive="true"
                className={buttonTone("secondary", { size: "sm" })}
              >
                핀 고정
              </button>
            )}
            {pinned ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={!onMoveUp}
                  data-interactive="true"
                  className={buttonTone("secondary", { size: "sm" })}
                >
                  ↑ 위로
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={!onMoveDown}
                  data-interactive="true"
                  className={buttonTone("secondary", { size: "sm" })}
                >
                  ↓ 아래
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <span className={labelPillClass}>식별자 없음</span>
        )}
      </div>
    </CardTile>
  );
}
