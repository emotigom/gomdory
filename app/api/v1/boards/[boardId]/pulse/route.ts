import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { resetPulse } from "@/lib/data/pulse";
import { goneResponse } from "@/lib/http/gone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  const payload = (await request.json().catch(() => null)) as { action?: string } | null;
  if (payload?.action !== "reset") {
    return jsonError("invalid_action", "지원하지 않는 동작입니다.", 400);
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("share_code, tools_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !board?.share_code) {
    return jsonError("share_unavailable", "공유 코드가 필요합니다. 공유 설정을 확인해주세요.", 400);
  }

  if (!hasToolEnabled(board.tools_enabled, "pulse")) {
    return goneResponse();
  }

  try {
    const counts = await resetPulse(board.share_code);
    return NextResponse.json({ ok: true, data: { counts } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이해도 상태를 초기화하지 못했습니다.";
    return jsonError("pulse_failed", message, 400);
  }
}
