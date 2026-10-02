import { NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { listClipShares } from "@/lib/data/sessionClipShares";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(
  _request: Request,
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

  try {
    const items = await listClipShares(sessionId);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "클립 목록을 불러오지 못했습니다.";
    return jsonError("clip_list_failed", message, 502);
  }
}
