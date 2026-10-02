"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

import { DashboardButton } from "./_components/dashboardUi";
import { trackDashboardAnalyticsEvent } from "./dashboardAnalytics";
import { decideRecentBoardAction } from "./recentBoardAction";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";

type DashboardRecentBoardButtonProps = {
  lastOpenedBoardId: string | null;
};

export default function DashboardRecentBoardButton({ lastOpenedBoardId }: DashboardRecentBoardButtonProps) {
  const router = useRouter();
  const boardHref = lastOpenedBoardId ? boardBoardHref(lastOpenedBoardId) : null;

  const prefetchRecentBoard = useCallback(() => {
    if (!boardHref) {
      return;
    }

    router.prefetch(boardHref);
  }, [boardHref, router]);

  useEffect(() => {
    if (!boardHref) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      const idleCallbackId = window.requestIdleCallback(prefetchRecentBoard);
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(prefetchRecentBoard, 150);
    return () => window.clearTimeout(timeoutId);
  }, [boardHref, prefetchRecentBoard]);

  const handleClick = () => {
    const action = decideRecentBoardAction(lastOpenedBoardId);

    if (action.type === "navigate") {
      trackDashboardAnalyticsEvent({
        type: "recent-board-open-outcome",
        outcome: "navigate",
        boardId: action.boardId,
      });
      router.push(boardBoardHref(action.boardId), { scroll: false });
      return;
    }

    trackDashboardAnalyticsEvent({
      type: "recent-board-open-outcome",
      outcome: "fallback",
      reason: action.reason,
    });

    const createBoardSection = document.getElementById("dashboard-create-board");
    createBoardSection?.scrollIntoView({ behavior: "smooth", block: "start" });

    window.requestAnimationFrame(() => {
      const titleInput = document.getElementById("create-board-title") as HTMLInputElement | null;
      titleInput?.focus();
    });
  };

  return (
    <DashboardButton type="button" tone="neutral" onClick={handleClick} onMouseEnter={prefetchRecentBoard} onFocus={prefetchRecentBoard}>
      최근 보드 열기
    </DashboardButton>
  );
}
