import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getBoard } from "@/lib/data/boards.server";
import { loadTeacherBoardWalls } from "@/lib/board/teacherBoardSnapshot.server";
import {
  isQ2B10Authorized,
  q2B10Store,
  q2B10TeacherWalls,
} from "@/lib/q2/browser/multiUserPollingFixture";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

type SyncDeps = {
  requireUserApiFn?: typeof requireUserApi;
  getBoardFn?: typeof getBoard;
  loadTeacherBoardWallsFn?: typeof loadTeacherBoardWalls;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: SyncDeps = {},
) {
  const { boardId } = await params;

  if (isQ2B10Authorized(request.headers.get("x-q2-browser-fixture-authorized"))) {
    const fixture = q2B10Store();
    return NextResponse.json(
      {
        ok: true,
        boardId,
        walls: q2B10TeacherWalls(),
        stateVersion: fixture.stateVersion,
        syncedAt: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  let userId = "";
  try {
    const { user } = await (deps.requireUserApiFn ?? requireUserApi)();
    userId = user.id;
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const { board } = await (deps.getBoardFn ?? getBoard)(boardId, {
    userId,
  });
  if (!board) {
    return NextResponse.json(
      { ok: false, error: "보드를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const walls = await (deps.loadTeacherBoardWallsFn ?? loadTeacherBoardWalls)(
      board.id,
    );
    return NextResponse.json(
      {
        ok: true,
        boardId: board.id,
        walls,
        syncedAt: new Date().toISOString(),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "교사 보드를 동기화하지 못했습니다.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
