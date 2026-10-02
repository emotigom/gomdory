import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { logAudit } from "@/lib/data/audit";
import { generateShareCode } from "@/lib/data/share";
import { buildEduCodeHash, recordEduEvent } from "@/lib/edu/opsEvent";
import { buildPresentUrl, buildShareUrl } from "@/lib/http/publicLinks";
import { getRequestProto } from "@/lib/http/requestHost";
import { withRequestContext } from "@/lib/api/server/requestContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EnsureShareResponse = {
  ok: true;
  boardId: string;
  code: string;
  shareUrl: string;
  presentUrl: string;
};

type EnsureShareBoardResult = {
  id: string;
  shareCode: string | null;
  shareEnabled: boolean | null;
};

const toEnsureShareBoardResult = (board: {
  id: string;
  share_code: string | null;
  share_enabled: boolean | null;
}): EnsureShareBoardResult => ({
  id: board.id,
  shareCode: board.share_code ?? null,
  shareEnabled: board.share_enabled ?? null,
});

const ensureShareBoard = async (boardId: string): Promise<EnsureShareBoardResult> => {
  const supabase = createSupabaseServerClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, share_code, share_enabled")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    throw new Error("board_not_found");
  }

  if (board.share_code) {
    if (board.share_enabled) {
      return toEnsureShareBoardResult(board);
    }
    const { data: updated, error: updateError } = await supabase
      .from("boards")
      .update({
        ["share_enabled"]: true,
        ["share_updated_at"]: new Date().toISOString(),
        ["share_write_enabled"]: true,
        ["share_write_updated_at"]: new Date().toISOString(),
      })
      .eq("id", boardId)
      .select("id, share_code, share_enabled")
      .single();
    if (updateError || !updated) {
      return toEnsureShareBoardResult(board);
    }
    return toEnsureShareBoardResult(updated);
  }

  const nextShareCode = generateShareCode();
  const { data: updated, error: updateError } = await supabase
    .from("boards")
    .update({
      ["share_enabled"]: true,
      ["share_code"]: nextShareCode,
      ["share_updated_at"]: new Date().toISOString(),
      ["share_write_enabled"]: true,
      ["share_write_updated_at"]: new Date().toISOString(),
    })
    .eq("id", boardId)
    .is("share_code", null)
    .select("id, share_code, share_enabled")
    .maybeSingle();

  if (updateError) {
    throw new Error("share_ensure_failed");
  }

  if (updated?.share_code) {
    return toEnsureShareBoardResult(updated);
  }

  const { data: latest, error: latestError } = await supabase
    .from("boards")
    .select("id, share_code, share_enabled")
    .eq("id", boardId)
    .single();

  if (latestError || !latest?.share_code) {
    throw new Error("share_ensure_failed");
  }

  return toEnsureShareBoardResult(latest);
};

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  requestContext: { requestId: string },
): Promise<Response> {
  const { boardId } = await params;

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("unauthorized", "인증이 필요합니다.", requestContext.requestId, 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonErrorWithRequestId(
      "board_not_found",
      "보드를 확인하지 못했습니다.",
      requestContext.requestId,
      400,
    );
  }

  if (!boardRole) {
    return jsonErrorWithRequestId(
      "forbidden",
      "보드를 볼 권한이 없습니다.",
      requestContext.requestId,
      403,
    );
  }

  let ensured: EnsureShareBoardResult;
  try {
    ensured = await ensureShareBoard(boardId);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "share_ensure_failed";
    if (errorCode === "board_not_found") {
      return jsonErrorWithRequestId(
        "board_not_found",
        "보드를 확인하지 못했습니다.",
        requestContext.requestId,
        400,
      );
    }
    void recordEduEvent({
      type: "share_ensure_fail",
      boardId,
      requestId: requestContext.requestId,
      extra: { errorCode: "share_ensure_failed" },
    });
    return jsonErrorWithRequestId(
      "share_ensure_failed",
      "입장코드 생성에 실패했습니다.",
      requestContext.requestId,
      500,
    );
  }

  const proto = await getRequestProto(request.headers);
  const shareCode = ensured.shareCode ?? "";
  const shareUrl = buildShareUrl(shareCode, proto);
  const presentUrl = buildPresentUrl(shareCode, proto);
  const codeHash = await buildEduCodeHash(boardId, shareCode);

  const response: EnsureShareResponse = {
    ok: true,
    boardId,
    code: shareCode,
    shareUrl,
    presentUrl,
  };

  void logAudit({
    boardId,
    action: "share.ensured",
    targetType: "share",
    targetId: codeHash ?? null,
    meta: { shareEnabled: ensured.shareEnabled ?? null },
  });

  void recordEduEvent({
    type: "share_ensure_ok",
    boardId,
    codeHash,
    requestId: requestContext.requestId,
  });

  return jsonOkWithRequestId(response, requestContext.requestId);
}

export const POST = withRequestContext(handlePost);
