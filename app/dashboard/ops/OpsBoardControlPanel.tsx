"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { routes } from "@/lib/standards/routes";

export default function OpsBoardControlPanel() {
  const [boardId, setBoardId] = useState("");
  const normalizedBoardId = boardId.trim();

  const hrefs = useMemo(() => {
    if (!normalizedBoardId) {
      return {
        boardSettings: "#",
        toolsOwnership: "#",
        boardDetail: "#",
      };
    }

    return {
      boardSettings: routes.page.dashboard.boardGrid(normalizedBoardId),
      toolsOwnership: routes.page.dashboard.boardBoard(normalizedBoardId),
      boardDetail: routes.page.dashboard.board(normalizedBoardId),
    };
  }, [normalizedBoardId]);

  const disabled = !normalizedBoardId;

  const actionClass =
    "rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">보드 관리 허브</p>
        <p className="text-xs text-slate-500">
          보드 설정, 도구 토글, 소유권 요청을 ops에서 빠르게 확인합니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600">Board ID</label>
        <input
          value={boardId}
          onChange={(event) => setBoardId(event.target.value)}
          placeholder="board id 입력"
          className="w-full min-w-[220px] flex-1 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none sm:max-w-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefs.boardSettings}
          aria-disabled={disabled}
          className={`${actionClass} ${disabled ? disabledClass : ""}`}
        >
          보드 설정 (그리드)
        </Link>
        <Link
          href={hrefs.toolsOwnership}
          aria-disabled={disabled}
          className={`${actionClass} ${disabled ? disabledClass : ""}`}
        >
          도구/소유권 요청
        </Link>
        <Link
          href={hrefs.boardDetail}
          aria-disabled={disabled}
          className={`${actionClass} ${disabled ? disabledClass : ""}`}
        >
          보드 상세
        </Link>
      </div>
    </div>
  );
}
