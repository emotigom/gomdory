"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { getCreateBoardExpanded, setCreateBoardExpanded } from "@/lib/dashboard/createBoardExpanded";
import { dashboardGlassButtonClass } from "@/app/dashboard/_components/dashboardGlassButton";
import { trackMarketingFunnelEvent } from "@/lib/analytics/marketingFunnel";
import { boardBoardHref, boardPresentHref } from "@/lib/dashboard/boardHrefs";
import { getGuidedPathSelection } from "@/lib/dashboard/guidedPath";

import CreateBoardForm from "./CreateBoardForm";
import { trackDashboardAnalyticsEvent } from "./dashboardAnalytics";
import { DASHBOARD_CREATE_BOARD_SUCCESS_EVENT, type DashboardCreateBoardSuccessDetail } from "./createBoardSuccess";

export default function CreateBoardSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastCreatedBoardId, setLastCreatedBoardId] = useState<string | null>(null);
  const [guidedPathId, setGuidedPathId] = useState<string | null>(null);
  const contentId = useId();

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const expanded = await getCreateBoardExpanded();
      if (!isCancelled) {
        setIsExpanded(expanded);
        setGuidedPathId(getGuidedPathSelection()?.pathId ?? null);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleToggle = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    void setCreateBoardExpanded(nextExpanded);
  };

  const handleCreateSuccess = useCallback((detail: DashboardCreateBoardSuccessDetail) => {
    setIsExpanded(false);
    setLastCreatedBoardId(detail.boardId);
    void setCreateBoardExpanded(false);
    trackDashboardAnalyticsEvent({
      type: "create-board-success-dispatched",
      boardId: detail.boardId,
    });
    trackMarketingFunnelEvent("first_board_created", {
      location: "dashboard_create_board_section",
      path_id: guidedPathId ?? "direct",
      board_id: detail.boardId,
    });
    window.dispatchEvent(new CustomEvent(DASHBOARD_CREATE_BOARD_SUCCESS_EVENT, { detail }));
  }, [guidedPathId]);

  return (
    <section
      id="dashboard-create-board"
      data-dashboard-board-list-scope
      data-dashboard-create-sheet
      className="dashboard-create-sheet hud-toolbar-strip relative space-y-4 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black tracking-[0.14em] text-[var(--theme-accent)]">새 수업</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-[var(--theme-text)] sm:text-2xl">보드 한 장 펴기</h2>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">수업 이름만 정해도 바로 시작할 수 있어요.</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          className={dashboardGlassButtonClass("secondary", "dashboard-board-list-control min-w-0 px-3.5 py-2 text-sm [overflow-wrap:anywhere] active:translate-y-px")}
        >
          {isExpanded ? "닫기" : "새 보드 펼치기"}
        </button>
      </div>

      {isExpanded ? (
        <div id={contentId} className="space-y-4">
          <CreateBoardForm onSuccess={handleCreateSuccess} />
          <div className="dashboard-create-path p-4">
            <p className="text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">다른 만들기</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[var(--theme-text)]">웹사이트 만들기</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--theme-text-muted)]">소개·탐구·퀴즈·포트폴리오를 웹사이트로 만들어요.</p>
              </div>
              <Link
                href="/dashboard/websites/new"
                data-testid="dashboard-website-create-entry"
                className={dashboardGlassButtonClass("primary", "dashboard-board-list-control min-w-0 px-3 py-2 text-xs [overflow-wrap:anywhere] active:translate-y-px")}
              >
                웹사이트 열기
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div id={contentId} className="space-y-3">
          <p className="max-w-2xl text-sm leading-6 text-[var(--theme-text-muted)]">
            새 보드를 열거나, 아래 보드 서랍에서 만들던 수업을 이어가세요.
          </p>
          {lastCreatedBoardId ? (
            <div className="dashboard-create-success border-l-[7px] border-[var(--gom-mint)] bg-[#eef5e7] px-4 py-3">
              <p className="text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">보드 준비 완료</p>
              <p className="mt-1 text-sm font-black text-[var(--theme-text)]">학생 참여 화면을 확인하거나 발표를 시작하세요.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={boardBoardHref(lastCreatedBoardId)}
                  className={dashboardGlassButtonClass("secondary", "dashboard-board-list-control min-w-0 px-3 py-2 text-xs [overflow-wrap:anywhere] active:translate-y-px")}
                  onClick={() =>
                    trackMarketingFunnelEvent("classroom_action_cta_click", {
                      location: "dashboard_create_board_section",
                      path_id: guidedPathId ?? "blank_board",
                      action: "open_classroom",
                      board_id: lastCreatedBoardId,
                    })
                  }
                >
                  학생 화면 열기
                </Link>
                <Link
                  href={boardPresentHref(lastCreatedBoardId)}
                  className={dashboardGlassButtonClass("secondary", "dashboard-board-list-control min-w-0 px-3 py-2 text-xs [overflow-wrap:anywhere] active:translate-y-px")}
                  onClick={() =>
                    trackMarketingFunnelEvent("classroom_action_cta_click", {
                      location: "dashboard_create_board_section",
                      path_id: guidedPathId ?? "blank_board",
                      action: "open_projector",
                      board_id: lastCreatedBoardId,
                    })
                  }
                >
                  발표 시작
                </Link>
              </div>
            </div>
          ) : null}
          <div className="dashboard-create-path px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">다른 만들기</p>
                <p className="mt-1 text-sm font-black text-[var(--theme-text)]">웹사이트 만들기</p>
                <p className="mt-0.5 text-xs text-[var(--theme-text-muted)]">소개·탐구·퀴즈·포트폴리오를 웹사이트로 만들어요.</p>
              </div>
              <Link
                href="/dashboard/websites/new"
                data-testid="dashboard-website-create-entry"
                className={dashboardGlassButtonClass("primary", "dashboard-board-list-control min-w-0 px-3 py-2 text-xs [overflow-wrap:anywhere] active:translate-y-px")}
              >
                웹사이트 열기
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
