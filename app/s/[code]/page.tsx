import { cookies, headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { resolveMinimapMode } from "@/lib/data/boards";
import { getTeacherDefaults } from "@/lib/data/profile";
import type { ShareBoard } from "@/lib/data/share";
import { getHost, redirectToHostIfNeeded, STUDENT_HOST, TEACHER_HOST } from "@/lib/http/hosts";
import { normalizeViewerName } from "@/lib/share/normalizeViewerName";
import { resolvePublicShareBoard } from "@/lib/share/public/access";
import StudentBoardMinimal from "./_components/StudentBoardMinimal";
import StudentAppGalleryPanel from "./_components/StudentAppGalleryPanel";
import StudentAppSubmitPanel from "./_components/StudentAppSubmitPanel";
import StudentGuestBoardSmartLayer from "./_components/StudentGuestBoardSmartLayer";
import StudentLessonWorkspace from "./_components/StudentLessonWorkspace";
import { getActiveLessonSessionForBoard } from "@/lib/lesson-activities/sessions";
import { toSharedViewModel } from "@/lib/boards/toSharedViewModel";
import { toStudentBoardModel } from "@/lib/student/boardModel";
import { serializeStudentSharedViewModel } from "@/lib/student/serializeSharedViewModel";
import { getBoardWallpaperUrl } from "@/lib/boards/wallpaper.server";
import { DEFAULT_BOARD_THEME, normalizePersistedBoardTheme } from "@/lib/ui/boardTheme";
import {
  getQ2B4StudentEntryFixture,
  getQ2B5StudentCardFixture,
  isQ2B5StudentCardFixtureEnabled,
  isQ2B4StudentEntryFixtureEnabled,
  Q2_B4_FIXTURE_AUTHORIZATION_HEADER,
  isQ2B10FixtureEnabled, q2B10StudentFixture,
} from "@/lib/q2/browser/studentEntryFixture";

const DEFAULT_MINIMAP_MODE = "hover";

type SharedBoardSearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  other: {
    "gom:layout": "share",
    "gom:page": "share_root",
    "gom:panel:student_wall": "1",
  },
};

function StudentShareError({
  code,
  requestId,
  variant,
}: {
  code: string;
  requestId: string | null;
  variant: "missing" | "load";
}) {
  const heading =
    variant === "missing" ? "공유 코드를 찾을 수 없어요" : "공유 보드를 불러오는 중 문제가 발생했어요";
  const description =
    variant === "missing"
      ? "코드가 만료되었거나 잘못 입력되었을 수 있어요. 선생님께 새 코드를 요청해주세요."
      : "네트워크 상태를 확인하고 다시 시도해주세요. 문제가 이어지면 선생님께 알려주세요.";

  return (
    <div
      data-page-marker="student-board-error"
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),linear-gradient(135deg,#020617_0%,#07111f_48%,#082f49_100%)] px-6 py-16 text-center text-slate-100"
    >
      <div className="mx-auto max-w-3xl rounded-3xl border border-cyan-300/25 bg-slate-950/80 p-8 shadow-[0_24px_90px_rgba(14,165,233,0.18)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">Guest board</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">{heading}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          {description} <span className="font-mono font-semibold text-cyan-100">({code.toUpperCase()})</span>
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href={`/s/${code}`} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200">
            다시 시도
          </Link>
          <Link
            href={`/s?code=${code}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/25 bg-slate-900/80 px-5 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/10"
          >
            코드 다시 입력
          </Link>
        </div>
      </div>
      {requestId ? (
        <p className="mt-4 text-xs font-medium text-slate-500">
          요청 ID: <span className="font-mono">{requestId}</span>
        </p>
      ) : null}
    </div>
  );
}

function StudentBoardScrollAndWallpaperPolicy({
  wallpaperUrl,
  children,
}: {
  wallpaperUrl: string | null;
  children: ReactNode;
}) {
  return (
    <div
      data-share-board-shell="true"
      data-share-board-wallpaper={wallpaperUrl ? "true" : undefined}
    >
      <style>{`
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] {
          isolation: isolate;
        }
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] [data-scroll="board-main"] {
          overscroll-behavior-y: auto !important;
        }
        [data-share-board-shell="true"] [data-wheel-layer="compose-panel"] {
          display: none !important;
        }
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] [data-card-id] button[aria-label="카드 이동"] {
          min-width: 4.85rem !important;
          width: auto !important;
          height: 1.75rem !important;
          gap: 0.28rem;
          padding: 0 0.52rem !important;
          border-color: rgba(103, 232, 249, 0.56) !important;
          background: linear-gradient(135deg, rgba(8, 47, 73, 0.94), rgba(14, 116, 144, 0.90)) !important;
          color: rgba(236, 254, 255, 0.96) !important;
          box-shadow: 0 10px 24px rgba(2, 6, 23, 0.32), inset 0 1px 0 rgba(255,255,255,0.16) !important;
        }
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] [data-card-id] button[aria-label="카드 이동"]::after {
          content: "이동";
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.01em;
        }
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] [data-card-id] button[aria-label="카드 이동"] span[aria-hidden] span {
          background-color: currentColor !important;
        }
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] [data-card-id][data-drag-ready="true"] button[aria-label="카드 이동"],
        [data-share-board-shell="true"] [data-public-guest-board="modern-hud"] [data-card-id][data-dragging="true"] button[aria-label="카드 이동"] {
          border-color: rgba(253, 224, 71, 0.82) !important;
          background: linear-gradient(135deg, rgba(113, 63, 18, 0.96), rgba(202, 138, 4, 0.92)) !important;
          color: rgba(255, 251, 235, 0.98) !important;
        }
        [data-share-board-wallpaper="true"] [data-public-guest-board="modern-hud"] [data-scroll="board-main"] {
          background-image: none !important;
          background-attachment: scroll !important;
        }
      `}</style>
      {children}
    </div>
  );
}

function getSearchParamValue(searchParams: SharedBoardSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function shouldRenderStudentAppMode(searchParams: SharedBoardSearchParams) {
  const view = getSearchParamValue(searchParams, "view").trim().toLowerCase();
  const mode = getSearchParamValue(searchParams, "mode").trim().toLowerCase();
  const lessonKit = getSearchParamValue(searchParams, "lessonKit").trim();

  return view === "student-app" || mode === "coding" || (lessonKit.length > 0 && !view && !mode);
}

function StudentAppCodingWorkspace({
  boardId,
  boardTitle,
  shareCode,
  wallpaperUrl,
}: {
  boardId: string;
  boardTitle: string;
  shareCode: string;
  wallpaperUrl: string | null;
}) {
  return (
    <StudentBoardScrollAndWallpaperPolicy wallpaperUrl={wallpaperUrl}>
      <main
        data-page-marker="student-app-coding"
        data-student-app-route-mode="true"
        className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4">
          <header className="rounded-2xl border border-cyan-200/25 bg-slate-900/88 px-4 py-4 shadow-[0_24px_70px_rgba(8,47,73,0.28)] ring-1 ring-inset ring-white/10 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-[-0.02em] text-white sm:text-3xl">학생 코딩 화면</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  HTML/CSS/JS를 수정하고 오른쪽 미리보기로 확인한 뒤 제출해요.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">보드: {boardTitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/s/${shareCode}`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-white/[0.07] px-3.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  학생 보드로 돌아가기
                </Link>
                <StudentAppGalleryPanel boardId={boardId} shareCode={shareCode} />
              </div>
            </div>
          </header>

          <section className="rounded-2xl border border-white/10 bg-slate-900/82 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.36)] ring-1 ring-inset ring-white/10 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">빠른 이동</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  친구 작품 보기는 보조 화면이에요. 실제 코딩과 제출은 아래 편집 화면에서 진행해요.
                </p>
              </div>
            </div>
          </section>

          <StudentAppSubmitPanel boardId={boardId} shareCode={shareCode} displayMode="inline" />
        </div>
      </main>
    </StudentBoardScrollAndWallpaperPolicy>
  );
}

export default async function SharedBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<SharedBoardSearchParams>;
}) {
  const requestHeaders = await headers();
  const host = await getHost();
  const { code } = await params;

  await redirectToHostIfNeeded({
    desiredHost: STUDENT_HOST,
    requestUrl: new URL(`/s/${encodeURIComponent(code)}`, `https://${host || TEACHER_HOST}`),
  });

  const resolvedSearchParams = (await searchParams) ?? {};
  const renderStudentAppMode = shouldRenderStudentAppMode(resolvedSearchParams);
  const cookieStore = await cookies();
  const viewerName = normalizeViewerName(cookieStore.get("gomdori_student_name")?.value ?? "");
  const requestId =
    requestHeaders.get("x-request-id") ??
    requestHeaders.get("cf-ray") ??
    requestHeaders.get("x-nf-request-id") ??
    null;

  let board: ShareBoard | null = null;
  let normalizedCode = code;
  let loadError: Error | null = null;
  const fixtureAuthorized = requestHeaders.get(Q2_B4_FIXTURE_AUTHORIZATION_HEADER);
  const b5FixtureEnabled = isQ2B5StudentCardFixtureEnabled(fixtureAuthorized);
  const b10FixtureEnabled = isQ2B10FixtureEnabled(fixtureAuthorized);
  const fixture = (b10FixtureEnabled && code.toLowerCase() === "q2b10a" ? q2B10StudentFixture() : null) ?? getQ2B5StudentCardFixture(code, b5FixtureEnabled) ?? getQ2B4StudentEntryFixture(
    code,
    isQ2B4StudentEntryFixtureEnabled(fixtureAuthorized),
  );

  try {
    if (fixture) {
      normalizedCode = code.toLowerCase();
      board = fixture.board;
    } else {
      const resolved = await resolvePublicShareBoard(code);
      normalizedCode = resolved.normalizedCode;
      board = resolved.board;
    }
  } catch (error) {
    loadError = error instanceof Error ? error : new Error("Unknown load error");
  }

  if (loadError) {
    return <StudentShareError code={normalizedCode} requestId={requestId} variant="load" />;
  }

  if (!board) {
    return <StudentShareError code={normalizedCode} requestId={requestId} variant="missing" />;
  }

  let viewModel: Awaited<ReturnType<typeof toSharedViewModel>> | null = null;
  let studentItems: ReturnType<typeof toStudentBoardModel> | null = null;

  try {
    viewModel = fixture?.viewModel ?? await toSharedViewModel(board.id, normalizedCode);
    const safeViewModel = serializeStudentSharedViewModel(viewModel);
    studentItems = toStudentBoardModel(safeViewModel);
    // The product mapper intentionally omits empty columns. B5 must exercise the
    // real empty-section composer, so retain its single authorized fixture section.
    if ((b5FixtureEnabled || b10FixtureEnabled) && studentItems.columns.length === 0) {
      const fixtureColumn = safeViewModel.columns[0];
      if (fixtureColumn) {
        studentItems = {
          ...studentItems,
          columns: [{
            key: fixtureColumn.id,
            title: fixtureColumn.title,
            cards: [],
            studentWriteEnabled: fixtureColumn.studentWriteEnabled,
            uiColorToken: fixtureColumn.uiColorToken,
          }],
        };
      }
    }
  } catch (error) {
    loadError = error instanceof Error ? error : new Error("Unknown load error");
  }

  if (loadError || !viewModel || !studentItems) {
    return <StudentShareError code={normalizedCode} requestId={requestId} variant="load" />;
  }

  const teacherDefaults = fixture ? null : await getTeacherDefaults(board.owner_id).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "student_share_teacher_defaults_failed",
        code: normalizedCode,
        boardId: board.id,
        ownerId: board.owner_id,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });
  const fixtureWallpaperUrl =
    fixture && "wallpaperUrl" in fixture && typeof fixture.wallpaperUrl === "string"
      ? fixture.wallpaperUrl
      : null;
  const wallpaperUrl = fixture ? fixtureWallpaperUrl : await getBoardWallpaperUrl(board.ui_wallpaper_key ?? null).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "student_share_wallpaper_failed",
        code: normalizedCode,
        boardId: board.id,
        wallpaperKey: board.ui_wallpaper_key ?? null,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });
  const activeLessonSession = fixture ? null : await getActiveLessonSessionForBoard(board.id).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "student_share_active_lesson_session_failed",
        code: normalizedCode,
        boardId: board.id,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });
  const resolvedMinimapMode = resolveMinimapMode(
    board.ui_minimap_mode ?? null,
    teacherDefaults?.defaultMinimapMode ?? DEFAULT_MINIMAP_MODE,
  );
  const persistedBoardTheme = normalizePersistedBoardTheme(board.ui_theme_config) ?? DEFAULT_BOARD_THEME;

  const boardProps = {
    boardId: board.id,
    model: studentItems,
    title: board.title,
    shareCode: normalizedCode,
    viewerName,
    shareWriteEnabled: board.share_write_enabled,
    classState: board.class_state,
    minimapMode: resolvedMinimapMode,
    wallpaperUrl,
    activeLessonTemplateId: activeLessonSession?.templateId ?? null,
    boardTheme: persistedBoardTheme,
  } as const;

  if (renderStudentAppMode) {
    return (
      <StudentAppCodingWorkspace
        boardId={board.id}
        boardTitle={board.title}
        shareCode={normalizedCode}
        wallpaperUrl={wallpaperUrl}
      />
    );
  }

  if (activeLessonSession) {
    return (
      <StudentBoardScrollAndWallpaperPolicy wallpaperUrl={wallpaperUrl}>
        <StudentLessonWorkspace activeLesson={activeLessonSession} board={boardProps} />
      </StudentBoardScrollAndWallpaperPolicy>
    );
  }

  return (
    <StudentBoardScrollAndWallpaperPolicy wallpaperUrl={wallpaperUrl}>
      <StudentGuestBoardSmartLayer
        model={studentItems}
        shareCode={normalizedCode}
        viewerName={viewerName}
        shareWriteEnabled={board.share_write_enabled}
        classState={board.class_state}
        fixtureCardCreationEnabled={b5FixtureEnabled || b10FixtureEnabled}
      >
        <div data-page-marker="student-board" className="min-h-screen bg-slate-950">
          <StudentBoardMinimal {...boardProps} />
        </div>
      </StudentGuestBoardSmartLayer>
    </StudentBoardScrollAndWallpaperPolicy>
  );
}
