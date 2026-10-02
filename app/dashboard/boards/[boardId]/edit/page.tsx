import Link from "next/link";
import { notFound } from "next/navigation";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { getBoard } from "@/lib/data/boards.server";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";
import { getBoardWallpaperUrl } from "@/lib/boards/wallpaper.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { updateBoardAction } from "./actions";
import BoardWallpaperSettingsClient from "./BoardWallpaperSettingsClient";

export default async function BoardEditPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const { user } = await requireUser(`/dashboard/boards/${boardId}/edit`);
  const { board } = await getBoard(boardId, { userId: user.id });

  if (!board) {
    return notFound();
  }

  const supabase = createSupabaseServerClient();
  const { data: roleResult } = await supabase.rpc("board_role", { bid: board.id });
  const canViewDiagnostics = canEditBoard(normalizeBoardRole(roleResult));
  const diagnosticsHref = `/dashboard/boards/${board.id}/lesson-run-diagnostics`;

  const wallpaperUrl = await getBoardWallpaperUrl(board.ui_wallpaper_key ?? null).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        stage: "board_edit_wallpaper_failed",
        boardId: board.id,
        wallpaperKey: board.ui_wallpaper_key ?? null,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-2 py-1 sm:px-0">
      <header className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-text-muted)]">Dashboard / Boards</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--theme-text)] sm:text-3xl">보드 설정</h1>
        <p className="mt-2 text-sm text-[var(--theme-text-muted)]">{board.title} 보드의 기본 정보와 배경을 관리합니다.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-[var(--theme-text)]">기본 정보</h2>
            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">현재 보드에서 사용하는 제목과 설명만 안전하게 수정할 수 있습니다.</p>

            <form action={updateBoardAction.bind(null, boardId)} className="mt-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--theme-text)]" htmlFor="title">
                  보드 제목
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={board.title}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2.5 text-sm text-[var(--theme-text)] shadow-sm outline-none transition placeholder:text-[var(--theme-text-subtle)] focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--theme-accent)_35%,transparent)]"
                  maxLength={60}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--theme-text)]" htmlFor="description">
                  설명
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={board.description ?? ""}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2.5 text-sm text-[var(--theme-text)] shadow-sm outline-none transition placeholder:text-[var(--theme-text-subtle)] focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--theme-accent)_35%,transparent)]"
                  rows={5}
                  maxLength={200}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button type="submit" className="rounded-xl hud-action-button bg-[var(--theme-action-bg)] px-4 py-2 text-sm font-semibold text-[var(--theme-action-text)] transition">
                  저장
                </button>
                <Link href={boardBoardHref(boardId)} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-4 py-2 text-sm font-medium text-[var(--theme-text)] transition hover:bg-[var(--theme-surface)]">
                  보드로 돌아가기
                </Link>
              </div>
            </form>
          </section>

          <BoardWallpaperSettingsClient
            boardId={board.id}
            initialWallpaperKey={board.ui_wallpaper_key ?? null}
            initialWallpaperUrl={wallpaperUrl}
          />
        </div>

        <aside className="space-y-4">
          <section className="hud-section-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--theme-text)]">안내</h3>
            <p className="mt-2 text-sm text-[var(--theme-text-muted)]">보드 배경은 보드 주인 화면과 게스트 공유 화면에 표시됩니다. 공개 공유 토큰은 이 화면에서 제공하지 않습니다.</p>
          </section>
          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--theme-text)]">빠른 이동</h3>
            <Link href={boardBoardHref(boardId)} className="mt-3 block rounded-lg bg-[var(--theme-accent)] px-3 py-2 text-center text-sm font-medium text-[var(--theme-action-text)]">
              보드로 돌아가기
            </Link>
            {canViewDiagnostics ? (
              <Link
                href={diagnosticsHref}
                className="mt-3 block text-center text-xs font-medium text-[var(--theme-text-muted)] underline-offset-4 transition hover:text-[var(--theme-text)] hover:underline"
              >
                수업 상태 진단
              </Link>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
