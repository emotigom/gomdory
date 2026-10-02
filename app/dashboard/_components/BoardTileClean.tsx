"use client";

import { useRef } from "react";
import Link from "next/link";

import CardTile from "@/app/_components/CardTile";
import MoreMenu from "@/app/_components/MoreMenu";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { preventNativeDragProps } from "@/app/_components/preventNativeDrag";
import type { DashboardBoardSummary } from "@/lib/data/boards";
import { boardBoardHref, boardHubHref } from "@/lib/dashboard/boardHrefs";

import { scheduleDashboardForceNavigationFallback } from "../forceNavigationFallback";
import type { DashboardFolder } from "../boardFolders";
import { pushDashboardToast } from "../useDashboardToast";

type BoardTileCleanProps = {
  board: DashboardBoardSummary;
  pinned?: boolean;
  recent?: boolean;
  onRecent: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  folders?: DashboardFolder[];
  currentFolderId?: string | null;
  onMoveToFolder?: (boardId: string, folderId: string | null) => void;
};

export default function BoardTileClean({
  board,
  pinned,
  recent,
  onRecent,
  onDelete,
  folders = [],
  currentFolderId = null,
  onMoveToFolder,
}: BoardTileCleanProps) {
  const dragGuards = preventNativeDragProps();
  const boardId = board.boardId;
  const hasBoardId = Boolean(boardId);
  const isTempBoard = Boolean(boardId && boardId.startsWith("temp:"));
  const isReady = hasBoardId && !isTempBoard;
  const optimistic = Boolean((board as { __optimistic?: boolean }).__optimistic);
  const canDelete = Boolean(boardId) && isReady && !optimistic;
  const createdAtLabel = board.created_at ? new Date(board.created_at).toLocaleDateString("ko-KR") : null;
  const deleteLockRef = useRef(false);

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <CardTile
      variant="present"
      className="relative overflow-hidden cursor-default border-emerald-100 bg-white/95"
      data-dashboard-tile="clean"
      role="presentation"
      aria-disabled="true"
    >
      {boardId ? (
        <div className="absolute right-3 top-3">
          <MoreMenu
            label="보드 옵션"
            align="right"
            onTriggerClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {onMoveToFolder ? (
              <div className="border-b border-slate-100 pb-1">
                <p className="px-3 py-1 text-[11px] font-semibold text-slate-500">폴더로 이동</p>
                <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (boardId) onMoveToFolder(boardId, null); }} className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100">전체</button>
                {folders.map((folder) => (
                  <button key={folder.id} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (boardId) onMoveToFolder(boardId, folder.id); }} className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100">
                    {folder.name}{currentFolderId === folder.id ? " ✓" : ""}
                  </button>
                ))}
              </div>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (deleteLockRef.current) return;
                  deleteLockRef.current = true;
                  onDelete(boardId);
                  window.setTimeout(() => {
                    deleteLockRef.current = false;
                  }, 0);
                }}
                data-interactive="true"
                aria-label="보드 삭제"
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                삭제
              </button>
            ) : isTempBoard ? (
              <button
                type="button"
                aria-label="임시 보드 삭제 불가"
                aria-disabled="true"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  pushDashboardToast({
                    title: "임시 보드는 삭제할 수 없어요.",
                  });
                }}
                className="block w-full cursor-not-allowed rounded-md px-3 py-2 text-left text-sm text-gray-400"
              >
                삭제 불가
              </button>
            ) : (
              <span className="block px-3 py-2 text-sm text-gray-400">삭제 불가</span>
            )}
          </MoreMenu>
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold text-gray-900 line-clamp-1">{board.title}</h3>
          {pinned ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">PIN</span> : null}
          {recent ? <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">최근</span> : null}
          {isReady ? (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Ready</span>
          ) : null}
        </div>
        <p className="text-sm text-slate-700">
          {recent ? "최근 수업 보드" : "핀/최근 보드"} {createdAtLabel ? `· ${createdAtLabel}` : ""}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {isReady ? (
          <Link
            href={boardBoardHref(boardId)}
            data-interactive="true"
            data-force-nav="true"
            prefetch={false}
            {...dragGuards}
            onClick={(event) => {
              onRecent(boardId);
              scheduleDashboardForceNavigationFallback(event, boardBoardHref(boardId));
            }}
            className={cn(buttonTone("primary", { size: "lg", fullWidth: true, tone: "emerald" }), "min-h-[64px] text-lg")}
          >
            수업 시작
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              buttonTone("primary", { size: "lg", fullWidth: true, tone: "neutral" }),
              "min-h-[64px] cursor-not-allowed text-gray-500",
            )}
          >
            수업 시작 불가
          </button>
        )}
        {isReady ? (
          <Link
            href={boardHubHref(boardId)}
            data-interactive="true"
            data-force-nav="true"
            prefetch={false}
            {...dragGuards}
            onClick={(event) => {
              onRecent(boardId);
              scheduleDashboardForceNavigationFallback(event, boardHubHref(boardId));
            }}
            className={cn(buttonTone("secondary", { size: "lg", fullWidth: true }), "min-h-[64px] text-lg")}
          >
            보드 열기
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              buttonTone("secondary", { size: "lg", fullWidth: true }),
              "min-h-[64px] cursor-not-allowed text-gray-400",
            )}
          >
            보드 열기
          </button>
        )}
      </div>
    </CardTile>
  );
}
