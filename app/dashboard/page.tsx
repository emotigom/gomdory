import type { Metadata } from "next";
import { headers } from "next/headers";
import { Q2_B6_BOARD_ID, Q2_B6_BOARD_TITLE, consumeQ4DashboardErrorRender, isQ2B6FixtureAuthorized, Q4_DASHBOARD_ERROR_FIXTURE_MODE } from "@/lib/q2/browser/teacherPreparationFixture";
import { Q2_B7_BOARD_ID, isQ2B7FixtureAuthorized } from "@/lib/q2/browser/teacherOperationFixture";

import { requireUser } from "@/lib/auth/requireUser";
import { listBoardsForUser } from "@/lib/data/boards.server";
import { isDashboardHintsV1Enabled, isDashboardHomeCardsV1Enabled } from "@/lib/dashboard/featureFlags";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { routes } from "@/lib/standards/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseCanonicalClientEnvReady } from "@/lib/env/appConfig";
import { getLastOpenedBoardId } from "@/lib/dashboard/lastOpenedBoard.server";
import { getPinnedBoardIds } from "@/lib/dashboard/pinnedBoards.server";
import { sortBoardsForDashboard } from "@/lib/dashboard/sortBoardsForDashboard";
import { filterDeletedBoardReferences } from "@/lib/dashboard/filterDeletedBoardRefs";
import { persistBoardReferenceCleanup } from "@/lib/dashboard/boardRefs.server";
import { parseNavConfig } from "@/lib/site-content/navConfig";
import { getSiteContentByKey } from "@/lib/site-content/server";

import CreateBoardSection from "./CreateBoardSection";
import DashboardRecentBoardButton from "./DashboardRecentBoardButton";
import AiTelemetryWidget from "./_components/AiTelemetryWidget";
import DashboardBoardList from "./_components/DashboardBoardList";
import DashboardHomeSurface from "./_components/DashboardHomeSurface";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  other: {
    "gom:layout": "dashboard",
    "gom:page": "dashboard_minimal",
  },
};

export default async function DashboardPage() {
  const routeSource = "app/dashboard/page.tsx";
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    console.info("[dashboard] route source:", routeSource);
  }

  const requestHeaders = await headers();
  const q2B6 = isQ2B6FixtureAuthorized(requestHeaders.get("x-q2-browser-fixture-authorized"));
  const q2B7 = isQ2B7FixtureAuthorized(requestHeaders.get("x-q2-browser-fixture-authorized"));
  const requestId = getOrCreateRequestId(requestHeaders);
  const envMissing = !readSupabaseCanonicalClientEnvReady();

  if (q2B6 && process.env.Q2_BROWSER_FIXTURE_MODE === Q4_DASHBOARD_ERROR_FIXTURE_MODE) {
    if (process.env.Q4_DASHBOARD_LOADING_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, Number(process.env.Q4_DASHBOARD_LOADING_DELAY_MS)));
    consumeQ4DashboardErrorRender();
  }

  let boards: Awaited<ReturnType<typeof listBoardsForUser>> = [];
  let lastOpenedBoardId: string | null = null;
  let authState: { isAuthenticated?: boolean } = { isAuthenticated: false };
  let homeHubFallbackMessage: string | null = null;
  let pinnedBoardIds: string[] = [];
  let boardListLoaded = false;

  if (q2B6) {
    boards = [{ id: Q2_B6_BOARD_ID, title: Q2_B6_BOARD_TITLE, created_at: "2026-07-19T00:00:00.000Z" }] as Awaited<ReturnType<typeof listBoardsForUser>>;
    authState = { isAuthenticated: true }; boardListLoaded = true;
  } else if (q2B7) {
    boards = [{ id: Q2_B7_BOARD_ID, title: "Q2 B7 교사 수업 운영 테스트 보드", created_at: "2026-07-19T00:00:00.000Z" }] as Awaited<ReturnType<typeof listBoardsForUser>>;
    authState = { isAuthenticated: true }; boardListLoaded = true;
  } else if (envMissing) {
    homeHubFallbackMessage = "데이터 연결 필요";
  } else {
    try {
      const { user } = await requireUser(routes.page.dashboard.root());
      authState = { isAuthenticated: true };
      const supabase = createSupabaseServerClient();
      boards = await listBoardsForUser({ supabase, userId: user.id });
      boardListLoaded = true;
      [lastOpenedBoardId, pinnedBoardIds] = await Promise.all([
        getLastOpenedBoardId(user.id),
        getPinnedBoardIds(user.id),
      ]);

      const cleanedRefs = filterDeletedBoardReferences({
        boardIds: boards.map((board) => board.id),
        lastOpenedBoardId,
        pinnedBoardIds,
      });

      lastOpenedBoardId = cleanedRefs.lastOpenedBoardId;
      pinnedBoardIds = cleanedRefs.pinnedBoardIds;

      if (cleanedRefs.changed) {
        await persistBoardReferenceCleanup({
          userId: user.id,
          lastOpenedBoardId,
          pinnedBoardIds,
        });
      }
    } catch (error) {
      homeHubFallbackMessage = "데이터 연결 상태를 확인한 뒤 다시 시도해 주세요.";
      if (isDev) {
        console.error("[dashboard] failed to build home hub data", { requestId, error });
      }
    }
  }

  const hintsEnabled = isDashboardHintsV1Enabled();
  const homeCardsEnabled = isDashboardHomeCardsV1Enabled();
  const homeHubEnvMissing = envMissing || Boolean(homeHubFallbackMessage);

  const sortedBoards = sortBoardsForDashboard(
    boards.map((board) => ({
      ...board,
      createdAt: board.created_at,
      lastUpdatedAt: board.class_updated_at ?? board.created_at,
    })),
    lastOpenedBoardId,
    pinnedBoardIds,
  );

  const recentActivity = sortedBoards.slice(0, 3).map((board) => ({
    id: board.id,
    title: board.title || "이름 없는 보드",
    createdAtLabel: new Date(board.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
  }));

  const navConfig = await getSiteContentByKey("site_nav_config").catch(() => null);
  const parsedNavConfig = navConfig ? parseNavConfig(navConfig.body) : null;
  const dashboardHelpLinks = (parsedNavConfig?.dashboardHelpLinks ?? []).map((item, index) => ({
    id: `help-${index}`,
    label: item.label,
    href: item.href,
  }));

  const nextActions = (sortedBoards.length > 0
    ? [
        {
          id: "open-recent",
          label: "최근 보드 열기",
          href: `/dashboard/boards/${lastOpenedBoardId ?? sortedBoards[0]?.id}`,
        },
        { id: "new-board", label: "새 보드 만들기", href: "/dashboard" },
      ]
    : [{ id: "new-board", label: "첫 보드 만들기", href: "/dashboard" }]).slice(0, 2);

  return (
    <main
      data-hud-theme-surface="dashboard-home"
      data-dashboard-workshop-version="2"
      className="hud-page-shell hud-dashboard-home min-h-[calc(100vh-72px)] w-full bg-transparent px-4 py-7 text-[var(--theme-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:gap-6">
      <header className="hud-dashboard-hero dashboard-workbench-hero hud-card-shell relative grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-2xl">
          <p className="dashboard-workbench-kicker text-[10px] font-black tracking-[0.14em] text-[var(--theme-accent)]">01 · 오늘의 작업대</p>
          <h1 className="mt-2 text-[2.35rem] font-black tracking-[-0.06em] text-[var(--theme-text)] sm:text-[3.25rem]">내 수업 작업대</h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[var(--theme-text-muted)] sm:text-base">
            만들던 보드를 꺼내고, 새 수업을 바로 시작하세요.
          </p>
        </div>
        <div className="dashboard-workbench-file flex min-w-[13rem] flex-col gap-3">
          <div className="flex items-end justify-between gap-4">
            <span className="text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">수업 파일</span>
            <strong className="text-3xl font-black tabular-nums text-[var(--theme-text)]">{sortedBoards.length}</strong>
          </div>
          <DashboardRecentBoardButton lastOpenedBoardId={lastOpenedBoardId ?? null} />
        </div>
      </header>

      {hintsEnabled ? <div data-testid="dashboard-hints-v1-enabled" hidden /> : <div data-testid="dashboard-hints-v1-disabled" hidden />}
      {homeCardsEnabled ? <div data-testid="dashboard-home-cards-v1-enabled" hidden /> : <div data-testid="dashboard-home-cards-v1-disabled" hidden />}
      {/* guard marker: hintsEnabled={hintsEnabled} */}

      <section className="dashboard-create-drawer"><CreateBoardSection /></section>

      <section className="dashboard-board-register overflow-hidden rounded-[var(--ui-radius-md)] border border-[var(--theme-border)] bg-[var(--theme-panel)] shadow-[var(--theme-shadow)]">
        <header className="dashboard-register-heading flex flex-wrap items-end justify-between gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.14em] text-[var(--theme-accent)]">02 · 보드 서랍</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--theme-text)] sm:text-3xl">내가 만든 보드</h2>
          </div>
          <span className="dashboard-register-count text-xs font-black text-[var(--theme-text)]">{sortedBoards.length}개</span>
        </header>
        <div className="dashboard-register-body p-3">
          <DashboardBoardList
            initialBoards={sortedBoards.map((board) => ({
              id: board.id,
              title: board.title,
              created_at: board.created_at,
              lastUpdatedAt: board.class_updated_at ?? board.created_at,
            }))}
            initialPinnedBoardIds={pinnedBoardIds}
            initialLastOpenedBoardId={lastOpenedBoardId}
            initialLoadSucceeded={boardListLoaded}
          />
        </div>
      </section>

      <DashboardHomeSurface
        recentActivity={recentActivity}
        boards={sortedBoards}
        authState={authState}
        envMissing={homeHubEnvMissing}
        requestId={requestId}
        nextActions={nextActions}
        homeCardsEnabled={homeCardsEnabled}
        tipsShortcut="⌘/Ctrl + K · 보드 검색"
        fallbackMessage={homeHubFallbackMessage}
        dashboardHelpLinks={dashboardHelpLinks}
      />

      <details className="dashboard-ai-drawer overflow-hidden rounded-[var(--ui-radius-md)] border border-[var(--theme-border)] bg-[var(--theme-panel)]">
        <summary className="dashboard-ai-drawer-summary flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <span>
            <span className="block text-[10px] font-black tracking-[0.14em] text-[var(--theme-text-muted)]">도구 서랍</span>
            <span className="mt-1 block text-base font-black text-[var(--theme-text)]">AI 수업 연결 상태</span>
          </span>
          <span className="dashboard-ai-drawer-sign" aria-hidden>+</span>
        </summary>
        <div className="dashboard-ai-drawer-body border-t border-[var(--theme-border)] p-3"><AiTelemetryWidget /></div>
      </details>
      </div>

      {isDev ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-[var(--ui-radius-sm)] bg-[var(--ui-ink-strong)] px-3 py-1 text-xs font-semibold text-white shadow-lg">
          DASHBOARD: {routeSource}
        </div>
      ) : null}
    </main>
  );
}
