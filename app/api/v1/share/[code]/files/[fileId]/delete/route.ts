import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicShareWriteGuard, resolvePublicShareBoard } from "@/lib/share/public/access";
import {
  deleteQ2B10Upload,
  deleteQ4StudentComposeUpload,
  isQ2B10FixtureEnabled,
  isQ2B5StudentCardFixtureEnabled,
  Q2_B10_SHARE_CODE,
  Q2_B5_VALID_CODE,
  q2B10WriteGuard,
} from "@/lib/q2/browser/studentEntryFixture";

type DeleteBody = {
  clientId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; fileId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { code, fileId } = await params;
    const body = (await request.json().catch(() => ({}))) as DeleteBody;

    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return jsonErrorWithRequestId("VALIDATION_ERROR", "clientId is required", requestId, 400);
    }

    if (isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B5_VALID_CODE) return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
      return deleteQ4StudentComposeUpload(fileId) ? jsonOkWithRequestId({}, requestId) : jsonErrorWithRequestId("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", requestId, 404);
    }

    if (isQ2B10FixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B10_SHARE_CODE) {
        return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
      }
      const writeGuard = q2B10WriteGuard();
      if (!writeGuard.ok) {
        return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
      }
      return deleteQ2B10Upload(fileId, clientId)
        ? jsonOkWithRequestId({}, requestId)
        : jsonErrorWithRequestId("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", requestId, 404);
    }

    const { board } = await resolvePublicShareBoard(code);
    if (!board) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }

    const writeGuard = getPublicShareWriteGuard(board);
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("files")
      .select(
        "id, deleted_at, cards!inner(author_type, author_client_id, walls!inner(board_id))",
      )
      .eq("id", fileId)
      .maybeSingle();

    if (error) {
      return jsonErrorWithRequestId("SUPABASE_ERROR", error.message, requestId, 400);
    }

    const row = data as
      | {
          id: string;
          deleted_at: string | null;
          cards:
            | {
                author_type: string | null;
                author_client_id: string | null;
                walls: { board_id: string } | null;
              }
            | null;
        }
      | null;

    if (!row || row.deleted_at || !row.cards || !row.cards.walls || row.cards.walls.board_id !== board.id) {
      return jsonErrorWithRequestId("FILE_NOT_FOUND", "파일을 찾을 수 없습니다.", requestId, 404);
    }

    if (row.cards.author_type !== "student") {
      return jsonErrorWithRequestId("FORBIDDEN", "허용되지 않은 요청입니다.", requestId, 403);
    }

    if (!row.cards.author_client_id || row.cards.author_client_id !== clientId) {
      return jsonErrorWithRequestId("FORBIDDEN", "허용되지 않은 요청입니다.", requestId, 403);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("files")
      .update({ deleted_at: now })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonErrorWithRequestId("DELETE_FAILED", message, requestId, 400);
  }
}
