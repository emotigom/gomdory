import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Q2_B6_BOARD_ID, Q2_B6_BOARD_TITLE, Q2_B6_SHARE_CODE, Q2_B6_TEACHER_ID, isQ2B6FixtureAuthorized, q2B6Walls } from "@/lib/q2/browser/teacherPreparationFixture";
import { Q2_B7_BOARD_ID, Q2_B7_OWNER_ID, Q2_B7_VIEWER_ID, isQ2B7FixtureAuthorized, q2B7Role, readTeacherOperationSnapshot } from "@/lib/q2/browser/teacherOperationFixture";
import { Q2_B8_BOARD_ID, Q2_B8_OWNER_ID, Q2_B9_BOARD_ID, Q2_B9_OWNER_ID, isQ2B8FixtureAuthorized, isQ2B9FixtureAuthorized, readResultDownloadSnapshot } from "@/lib/q2/browser/resultDownloadFixture";
import { Q2_B10_BOARD_ID, Q2_B10_OWNER_ID, isQ2B10Authorized, q2B10TeacherWalls, q2B10Store } from "@/lib/q2/browser/multiUserPollingFixture";
import type { CSSProperties } from "react";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { getBoard } from "@/lib/data/boards.server";
import { canSoftDelete, getBoardPolicy } from "@/lib/data/boardPolicies";
import { ensureBoardShareCode } from "@/lib/data/share";
import { getActiveLessonSessionForBoard } from "@/lib/lesson-activities/sessions";
import { getAiBingoTeacherSummaryForBoard, getAiJudgmentSortTeacherSummaryForBoard, getPythonStudioLiteTeacherSummaryForBoard, getWebCodingLiteTeacherSummaryForBoard } from "@/lib/lesson-activities/progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBoardWallpaperUrl } from "@/lib/boards/wallpaper.server";
import { loadTeacherBoardWalls } from "@/lib/board/teacherBoardSnapshot.server";
import { DEFAULT_BOARD_THEME, normalizePersistedBoardTheme, resolveBoardThemeVars } from "@/lib/ui/boardTheme";
import TeacherBoardCanonicalClient from "./TeacherBoardCanonicalClient";

export const dynamic = "force-dynamic";

export default async function TeacherBoardCanonicalPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const q2B6 = isQ2B6FixtureAuthorized((await headers()).get("x-q2-browser-fixture-authorized"));
  if (q2B6 && boardId === Q2_B6_BOARD_ID) return <TeacherBoardCanonicalClient boardId={boardId} boardTitle={Q2_B6_BOARD_TITLE} boardDescription="로컬 교사 준비 fixture" boardAccessCode={Q2_B6_SHARE_CODE} initialBoardTheme={DEFAULT_BOARD_THEME} initialBoardThemeVars={resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher")} walls={q2B6Walls()} collaborationSummary={{ ownerLabel: "보드 소유자", memberCount: 1 }} currentUserId={Q2_B6_TEACHER_ID} canDeleteCards={false} initialActiveLessonSession={null} initialAiBingoSummary={null} initialAiJudgmentSortSummary={null} initialPythonStudioLiteSummary={null} initialWebCodingLiteSummary={null} />;
  const requestHeaders = await headers();
  const q2B7 = isQ2B7FixtureAuthorized(requestHeaders.get("x-q2-browser-fixture-authorized"));
  if (q2B7 && boardId === Q2_B7_BOARD_ID) { const role = q2B7Role(requestHeaders); const isOwner = role === "owner"; const fixture = readTeacherOperationSnapshot(); return <TeacherBoardCanonicalClient boardId={boardId} boardTitle="Q2 B7 교사 수업 운영 테스트 보드" boardDescription="로컬 교사 운영 fixture" boardAccessCode="q2b7op" initialBoardTheme={DEFAULT_BOARD_THEME} initialBoardThemeVars={resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher")} walls={fixture.walls} fixtureDataVersion={fixture.stateVersion} fixtureMode="q2-b7" collaborationSummary={{ ownerLabel: isOwner ? "보드 소유자" : "읽기 전용", memberCount: 2 }} currentUserId={isOwner ? Q2_B7_OWNER_ID : Q2_B7_VIEWER_ID} canDeleteCards={false} canOperateCards={isOwner} initialActiveLessonSession={null} initialAiBingoSummary={null} initialAiJudgmentSortSummary={null} initialPythonStudioLiteSummary={null} initialWebCodingLiteSummary={null} />; }
  const q2B10 = isQ2B10Authorized(requestHeaders.get("x-q2-browser-fixture-authorized"));
  if (q2B10 && boardId === Q2_B10_BOARD_ID) {
    const fixture = q2B10Store();
    return (
      <TeacherBoardCanonicalClient
        boardId={boardId}
        boardTitle={fixture.visualStress ? "AI 수업 교사 작업대 · 시각 검증" : "Q2 B10 다중 사용자 테스트 보드"}
        boardDescription={fixture.visualStress ? "실제 수업 밀도를 닮은 Q2-B11 로컬 시각 검증 fixture" : "로컬 다중 사용자 polling fixture"}
        boardAccessCode="q2b10a"
        initialBoardTheme={DEFAULT_BOARD_THEME}
        initialBoardThemeVars={resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher")}
        walls={q2B10TeacherWalls()}
        fixtureDataVersion={fixture.stateVersion}
        fixtureMode="q2-b10"
        collaborationSummary={{ ownerLabel: "보드 소유자", memberCount: 3 }}
        currentUserId={Q2_B10_OWNER_ID}
        canDeleteCards={false}
        canOperateCards
        initialActiveLessonSession={null}
        initialAiBingoSummary={null}
        initialAiJudgmentSortSummary={null}
        initialPythonStudioLiteSummary={null}
        initialWebCodingLiteSummary={null}
      />
    );
  }
  const q2B8 = isQ2B8FixtureAuthorized(requestHeaders.get("x-q2-browser-fixture-authorized"));
  if (q2B8 && boardId === Q2_B8_BOARD_ID) { const fixture = readResultDownloadSnapshot(); return <TeacherBoardCanonicalClient boardId={boardId} boardTitle="B8 결과 백업" boardDescription="로컬 다운로드 검증용 fixture" boardAccessCode="q2b8dl" initialBoardTheme={{ ...DEFAULT_BOARD_THEME, id: "calm" }} initialBoardThemeVars={resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher")} walls={fixture.walls} fixtureDataVersion={fixture.stateVersion} fixtureMode="q2-b8" collaborationSummary={{ ownerLabel: "보드 소유자", memberCount: 1 }} currentUserId={Q2_B8_OWNER_ID} canDeleteCards={false} initialActiveLessonSession={null} initialAiBingoSummary={null} initialAiJudgmentSortSummary={null} initialPythonStudioLiteSummary={null} initialWebCodingLiteSummary={null} />; }
  const q2B9 = isQ2B9FixtureAuthorized(requestHeaders.get("x-q2-browser-fixture-authorized"));
  if (q2B9 && boardId === Q2_B9_BOARD_ID) { const fixture = readResultDownloadSnapshot(); return <TeacherBoardCanonicalClient boardId={boardId} boardTitle="Q2 B9 Drive Integration" boardDescription="로컬 Google Drive 검증 fixture" boardAccessCode="q2b9drive" initialBoardTheme={{ ...DEFAULT_BOARD_THEME, id: "calm" }} initialBoardThemeVars={resolveBoardThemeVars(DEFAULT_BOARD_THEME, "teacher")} walls={fixture.walls} fixtureDataVersion={fixture.stateVersion} fixtureMode="q2-b8" collaborationSummary={{ ownerLabel: "보드 소유자", memberCount: 1 }} currentUserId={Q2_B9_OWNER_ID} canDeleteCards={false} initialActiveLessonSession={null} initialAiBingoSummary={null} initialAiJudgmentSortSummary={null} initialPythonStudioLiteSummary={null} initialWebCodingLiteSummary={null} />; }
  const { user } = await requireUser(`/dashboard/boards/${boardId}/board`);

  const { board } = await getBoard(boardId, { userId: user.id });

  if (!board) {
    return notFound();
  }

  const boardAccessCode = await ensureBoardShareCode(board.id).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "dashboard_board_share_code_ensure_failed",
        boardId,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return board.share_code ?? null;
  });

  const wallpaperUrl = await getBoardWallpaperUrl(board.ui_wallpaper_key ?? null).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "dashboard_board_wallpaper_failed",
        boardId,
        wallpaperKey: board.ui_wallpaper_key ?? null,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });

  const supabase = createSupabaseServerClient();
  let memberCount: number | null = null;
  try {
    const memberCountResult = await supabase
      .from("board_members")
      .select("user_id", { count: "exact", head: true })
      .eq("board_id", board.id);
    memberCount = memberCountResult.error ? null : memberCountResult.count ?? 0;
  } catch {
    memberCount = null;
  }

  const { data: roleResult } = await supabase.rpc("board_role", { bid: board.id });
  const boardRole = normalizeBoardRole(roleResult);
  const boardPolicy = await getBoardPolicy(board.id, supabase);
  const canDeleteCards = canSoftDelete(boardRole, boardPolicy);

  const activeLessonSession = await getActiveLessonSessionForBoard(board.id).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "dashboard_board_active_lesson_session_failed",
        boardId,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });

  const aiBingoSummary = activeLessonSession?.activityTypes.includes("ai_bingo")
    ? await getAiBingoTeacherSummaryForBoard(board.id).catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            stage: "dashboard_board_ai_bingo_summary_failed",
            boardId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return null;
      })
    : null;

  const aiJudgmentSortSummary = activeLessonSession?.activityTypes.includes("ai_judgment_sort")
    ? await getAiJudgmentSortTeacherSummaryForBoard(board.id).catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            stage: "dashboard_board_ai_judgment_sort_summary_failed",
            boardId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return null;
      })
    : null;

  const pythonStudioLiteSummary = activeLessonSession?.activityTypes.includes("python_studio_lite")
    ? await getPythonStudioLiteTeacherSummaryForBoard(board.id).catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            stage: "dashboard_board_python_studio_lite_summary_failed",
            boardId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return null;
      })
    : null;


  const webCodingLiteSummary = activeLessonSession?.activityTypes.includes("web_coding_lite")
    ? await getWebCodingLiteTeacherSummaryForBoard(board.id).catch((error) => {
        console.error(
          JSON.stringify({
            level: "error",
            stage: "dashboard_board_web_coding_lite_summary_failed",
            boardId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        return null;
      })
    : null;

  const wallCardsWithAttachments = await loadTeacherBoardWalls(board.id);

  const persistedBoardTheme = normalizePersistedBoardTheme(board.ui_theme_config) ?? DEFAULT_BOARD_THEME;
  const boardThemeVars = resolveBoardThemeVars(persistedBoardTheme, "teacher");
  const wallpaperStyle = {
    ...boardThemeVars,
    ...(wallpaperUrl
      ? {
          "--board-wallpaper-image": `url(${JSON.stringify(wallpaperUrl)})`,
        }
      : null),
  } as CSSProperties;

  return (
    <div data-board-wallpaper-shell={wallpaperUrl ? "true" : undefined} style={wallpaperStyle}>
      {wallpaperUrl ? (
        <style>{`
          [data-board-wallpaper-shell="true"] [data-board-runtime="teacher-board-canonical"] {
            background-image: linear-gradient(
              to bottom,
              color-mix(in srgb, var(--theme-bg) calc(var(--board-bg-dim-opacity) * 100%), transparent),
              color-mix(in srgb, var(--theme-bg) calc((var(--board-bg-dim-opacity) + var(--board-surface-opacity)) * 100%), transparent)
            ), var(--board-wallpaper-image);
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            background-attachment: fixed;
          }
        `}</style>
      ) : null}
      <TeacherBoardCanonicalClient
        boardId={board.id}
        boardTitle={board.title}
        boardDescription={board.description}
        boardAccessCode={boardAccessCode}
        initialBoardTheme={persistedBoardTheme}
        initialBoardThemeVars={boardThemeVars}
        walls={wallCardsWithAttachments}
        collaborationSummary={{ ownerLabel: "보드 소유자", memberCount: memberCount === null ? null : Math.max(1, memberCount) }}
        currentUserId={user.id}
        canDeleteCards={canDeleteCards}
        initialActiveLessonSession={activeLessonSession}
        initialAiBingoSummary={aiBingoSummary}
        initialAiJudgmentSortSummary={aiJudgmentSortSummary}
        initialPythonStudioLiteSummary={pythonStudioLiteSummary}
        initialWebCodingLiteSummary={webCodingLiteSummary}
      />
    </div>
  );
}
