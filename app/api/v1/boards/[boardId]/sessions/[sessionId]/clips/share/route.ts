import { NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import {
  createClipShare,
  isExpiresValidationError,
  isRangeValidationError,
  validateRange,
} from "@/lib/data/sessionClipShares";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ShareBody = {
  startTs?: string | number;
  endTs?: string | number;
  mode?: "safe" | "full";
  title?: string | null;
  expiresInDays?: number | null;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string; sessionId: string }> },
): Promise<Response> {
  const { boardId, sessionId } = await params;

  if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(sessionId)) {
    return jsonError("invalid_id", "ID 형식이 올바르지 않습니다.");
  }

  const { user } = await requireUserApi().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !canEditBoard(boardRole)) {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as ShareBody;

  try {
    validateRange(body.startTs ?? "", body.endTs ?? "");
  } catch (error) {
    if (isRangeValidationError(error)) {
      return jsonError(error.code, error.message, 400);
    }
    return jsonError("range_invalid", "클립 범위를 확인하지 못했습니다.");
  }

  try {
    const result = await createClipShare({
      boardId,
      sessionId,
      startTs: body.startTs ?? "",
      endTs: body.endTs ?? "",
      mode: body.mode,
      title: body.title ?? null,
      expiresInDays: body.expiresInDays === undefined ? undefined : body.expiresInDays,
    });

    return NextResponse.json({
      ok: true,
      token: result.token,
      url: result.url,
      qrPayload: result.qrPayload,
      share: {
        mode: result.share.mode,
        title: result.share.title,
        clip_start_ts: result.share.clip_start_ts,
        clip_end_ts: result.share.clip_end_ts,
        created_at: result.share.created_at,
        revoked_at: result.share.revoked_at,
        expires_at: result.share.expires_at,
      },
    });
  } catch (error) {
    if (isExpiresValidationError(error)) {
      return jsonError("expires_invalid", "만료 기간이 올바르지 않습니다.");
    }
    const message = error instanceof Error ? error.message : "클립 공유를 만들지 못했습니다.";
    return jsonError("clip_share_failed", message, 502);
  }
}
