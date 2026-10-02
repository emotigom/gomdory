"use client";

import Link from "next/link";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn, pill } from "@/app/_components/uiTokens";
import type { DashboardBoardSummary } from "@/lib/data/boards";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";

import MoreMenu from "@/app/_components/MoreMenu";
import BoardStatusBadge, { type BoardStatus } from "./BoardStatusBadge";
import type { DashboardFolder } from "../boardFolders";
type BoardTileFocusMiniProps = {
  board: DashboardBoardSummary;
  pinned?: boolean;
  recent?: boolean;
  active?: boolean;
  onSelect: (boardId: string) => void;
  onDelete?: (boardId: string) => void;
  hudHref?: string | null;
  classHref?: string | null;
  shareHref?: string | null;
  hasPreset?: boolean;
  hasShare?: boolean;
  status?: BoardStatus;
  statusActionLabel?: string;
  onStatusAction?: () => void;
  folders?: DashboardFolder[];
  currentFolderId?: string | null;
  onMoveToFolder?: (boardId: string, folderId: string | null) => void;
};

export default function BoardTileFocusMini({
  board,
  pinned,
  recent,
  active,
  onSelect,
  onDelete,
  hudHref,
  classHref,
  shareHref,
  hasPreset,
  hasShare,
  status,
  statusActionLabel,
  onStatusAction,
  folders = [],
  currentFolderId = null,
  onMoveToFolder,
}: BoardTileFocusMiniProps) {
  const boardId = board.boardId;
  const isTempBoard = Boolean(boardId && boardId.startsWith("temp:"));
  const disabled = !boardId || isTempBoard;
  const optimistic = Boolean((board as { __optimistic?: boolean }).__optimistic);
  const canDelete = Boolean(boardId) && !isTempBoard && !optimistic;

  return (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <CardTile
      calm
      variant="dense"
      className={cn(
        "relative overflow-hidden",
        active ? "ring-2 ring-indigo-400 bg-indigo-50 shadow-[0_0_0_4px_rgba(99,102,241,0.12)]" : "",
      )}
      data-board-id={boardId}
      data-dashboard-tile="focus"
      role="presentation"
      aria-disabled="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-2 text-[10px] font-semibold text-indigo-700">
            <span
              className={cn(
                "h-3 w-3 rounded-full",
                active ? "bg-emerald-500" : "bg-slate-300",
              )}
              aria-hidden="true"
            />
            <span>{active ? "LIVE" : "READY"}</span>
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{board.title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              {optimistic && status !== "failed" ? (
                <span className={cn(pill.badge, "bg-amber-50 text-amber-800 ring-1 ring-amber-100/80")}>생성중…</span>
              ) : null}
              {pinned ? (
                <span className={cn(pill.badge, "bg-amber-50 text-amber-800 ring-1 ring-amber-100/80")}>PIN</span>
              ) : null}
              {recent ? (
                <span className={cn(pill.badge, "bg-sky-50 text-sky-800 ring-1 ring-sky-100/90")}>최근</span>
              ) : null}
              {hasShare ? (
                <span className={cn(pill.badge, "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80")}>공유</span>
              ) : null}
              {hasPreset ? (
                <span className={cn(pill.badge, "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100/80")}>프리셋</span>
              ) : null}
              <BoardStatusBadge status={status} actionLabel={statusActionLabel} onAction={onStatusAction} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (boardId) {
                onSelect(boardId);
              }
            }}
            className={cn(
              buttonTone("secondary", { size: "sm" }),
              active ? "border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-700" : "",
              disabled ? "cursor-not-allowed opacity-60" : "",
            )}
            data-interactive="true"
          >
            선택
          </button>
          {classHref ? (
            <Link href={classHref} data-interactive="true" className={buttonTone("secondary", { size: "sm" })}>
              수업
            </Link>
          ) : null}
          {hudHref ? (
            <a
              href={hudHref}
              target="_blank"
              rel="noreferrer"
              data-interactive="true"
              className={buttonTone("secondary", { size: "sm" })}
            >
              HUD
            </a>
          ) : null}
          {shareHref ? (
            <a
              href={shareHref}
              target="_blank"
              rel="noreferrer"
              data-interactive="true"
              className={buttonTone("secondary", { size: "sm" })}
            >
              공유
            </a>
          ) : null}
          <MoreMenu label="더보기" align="right">
            {boardId ? (
              <>
                {onMoveToFolder ? (
                  <div className="border-b border-slate-100 pb-1">
                    <p className="px-3 py-1 text-[11px] font-semibold text-slate-500">폴더로 이동</p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onMoveToFolder(boardId, null);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                    >
                      전체
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onMoveToFolder(boardId, folder.id);
                        }}
                        className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                      >
                        {folder.name}{currentFolderId === folder.id ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Link
                  href={boardHubHref(boardId)}
                  data-interactive="true"
                  className="block rounded-md px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
                >
                  보드 열기
                </Link>
                <Link
                  href={`/dashboard/boards/${boardId}/edit`}
                  data-interactive="true"
                  className="block rounded-md px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
                >
                  설정
                </Link>
                {canDelete && onDelete ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDelete(boardId);
                    }}
                    data-interactive="true"
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                  >
                    삭제
                  </button>
                ) : null}
              </>
            ) : (
              <span className="block px-3 py-2 text-sm text-gray-400">보드 준비 중</span>
            )}
          </MoreMenu>
        </div>
      </div>
    </CardTile>
  );
}
