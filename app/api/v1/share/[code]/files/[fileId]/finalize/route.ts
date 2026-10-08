import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { finalizeUploadAsAdmin } from "@/lib/data/files";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicShareWriteGuard, resolvePublicShareBoard } from "@/lib/share/public/access";
import {
  finalizeQ2B10Upload,
  finalizeQ4StudentComposeUpload,
  isQ2B10FixtureEnabled,
  isQ2B5StudentCardFixtureEnabled,
  Q2_B10_SHARE_CODE,
  Q2_B5_VALID_CODE,
  q2B10WriteGuard,
} from "@/lib/q2/browser/studentEntryFixture";

type FinalizeBody = {
  clientId?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; fileId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { code, fileId } = await params;
    const body = (await request.json().catch(() => ({}))) as FinalizeBody;

    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "clientId is required",
        requestId,
        400,
      );
    }

    if (isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B5_VALID_CODE) return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
      return finalizeQ4StudentComposeUpload(fileId) ? jsonOkWithRequestId({}, requestId) : jsonErrorWithRequestId("FINALIZE_FAILED", "첨부 업로드에 실패했어요.", requestId, 400);
    }

    if (isQ2B10FixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B10_SHARE_CODE) {
        return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
      }
      const writeGuard = q2B10WriteGuard();
      if (!writeGuard.ok) {
        return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
      }
      return finalizeQ2B10Upload(fileId, clientId)
        ? jsonOkWithRequestId({}, requestId)
        : jsonErrorWithRequestId("FINALIZE_FAILED", "첨부 업로드에 실패했어요.", requestId, 400);
    }

    const { board } = await resolvePublicShareBoard(code);

    if (!board) {
      return jsonErrorWithRequestId(
        "BOARD_NOT_FOUND",
        "공유 보드를 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    const writeGuard = getPublicShareWriteGuard(board);
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("files")
      .select(
        "id, card_id, cards!inner(author_type, author_client_id, wall_id, walls!inner(board_id))",
      )
      .eq("id", fileId)
      .single();

    if (error) {
      return jsonErrorWithRequestId("SUPABASE_ERROR", error.message, requestId, 400);
    }

    const fileRecord = data as unknown as
      | {
          id: string;
          card_id: string;
          cards:
            | {
                author_type: string | null;
                author_client_id: string | null;
                wall_id: string;
                walls: { board_id: string } | null;
              }
            | null;
        }
      | null;

    if (!fileRecord || !fileRecord.cards || !fileRecord.cards.walls) {
      return jsonErrorWithRequestId(
        "FILE_NOT_FOUND",
        "파일 정보를 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    if (fileRecord.cards.walls.board_id !== board.id) {
      return jsonErrorWithRequestId(
        "FILE_NOT_FOUND",
        "파일 정보를 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    if (fileRecord.cards.author_type !== "student") {
      return jsonErrorWithRequestId(
        "FORBIDDEN",
        "허용되지 않은 요청입니다.",
        requestId,
        403,
      );
    }

    if (!fileRecord.cards.author_client_id || fileRecord.cards.author_client_id !== clientId) {
      return jsonErrorWithRequestId(
        "FORBIDDEN",
        "허용되지 않은 요청입니다.",
        requestId,
        403,
      );
    }

    await finalizeUploadAsAdmin(fileId);

    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonErrorWithRequestId("FINALIZE_FAILED", message, requestId, 400);
  }
}
