import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { toSharedViewModel } from "@/lib/boards/toSharedViewModel";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { resolvePublicShareBoard } from "@/lib/share/public/access";
import { serializeStudentSharedViewModel } from "@/lib/student/serializeSharedViewModel";
import { toStudentBoardModel } from "@/lib/student/boardModel";
import type { StudentBoardSyncData } from "@/lib/student/boardSyncContract";
import {
  getQ2B5StudentCardFixture,
  isQ2B5StudentCardFixtureEnabled,
  Q2_B5_VALID_CODE,
  isQ2B10FixtureEnabled, Q2_B10_SHARE_CODE, q2B10StudentFixture,
} from "@/lib/q2/browser/studentEntryFixture";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const requestId = getOrCreateRequestId(request);

  try {
    const { code } = await params;
    if (isQ2B10FixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B10_SHARE_CODE) return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404, undefined, { headers: NO_STORE_HEADERS });
      const fixture = q2B10StudentFixture(request.headers.get("x-q2-browser-client-label") ?? undefined);
      const payload = {
        boardId: fixture.board.id,
        shareCode: Q2_B10_SHARE_CODE,
        model: toStudentBoardModel(serializeStudentSharedViewModel(fixture.viewModel)),
        shareWriteEnabled: fixture.board.share_write_enabled,
        classState: fixture.board.class_state,
        stateVersion: fixture.stateVersion,
        syncedAt: new Date().toISOString(),
      } satisfies StudentBoardSyncData;
      return jsonOkWithRequestId(payload, requestId, { headers: NO_STORE_HEADERS });
    }
    if (isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      const fixture = getQ2B5StudentCardFixture(code, true);
      if (!fixture || code.toLowerCase() !== Q2_B5_VALID_CODE) {
        return jsonErrorWithRequestId(
          "BOARD_NOT_FOUND",
          "공유 보드를 찾을 수 없습니다.",
          requestId,
          404,
          undefined,
          { headers: NO_STORE_HEADERS },
        );
      }
      const payload = {
        boardId: fixture.board.id,
        shareCode: Q2_B5_VALID_CODE,
        model: toStudentBoardModel(serializeStudentSharedViewModel(fixture.viewModel)),
        shareWriteEnabled: fixture.board.share_write_enabled,
        classState: fixture.board.class_state,
        syncedAt: new Date().toISOString(),
      } satisfies StudentBoardSyncData;
      return jsonOkWithRequestId(payload, requestId, { headers: NO_STORE_HEADERS });
    }
    const { normalizedCode, board } = await resolvePublicShareBoard(code);

    if (!board) {
      return jsonErrorWithRequestId(
        "BOARD_NOT_FOUND",
        "공유 보드를 찾을 수 없습니다.",
        requestId,
        404,
        undefined,
        { headers: NO_STORE_HEADERS },
      );
    }

    const viewModel = await toSharedViewModel(board.id, normalizedCode);
    const model = toStudentBoardModel(serializeStudentSharedViewModel(viewModel));

    const payload = {
      boardId: board.id,
      shareCode: normalizedCode,
      model,
      shareWriteEnabled: board.share_write_enabled,
      classState: board.class_state,
      syncedAt: new Date().toISOString(),
    } satisfies StudentBoardSyncData;

    return jsonOkWithRequestId(payload, requestId, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "공유 보드를 동기화하지 못했습니다.";
    return jsonErrorWithRequestId(
      "SYNC_FAILED",
      message,
      requestId,
      500,
      undefined,
      { headers: NO_STORE_HEADERS },
    );
  }
}
