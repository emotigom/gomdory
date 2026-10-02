import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createPoll } from "@/lib/data/polls";
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

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("share_code, tools_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !board?.share_code) {
    return jsonError("share_unavailable", "공유 코드가 필요합니다. 공유 설정을 확인해주세요.", 400);
  }

  if (!hasToolEnabled(board.tools_enabled, "polls")) {
    return goneResponse();
  }

  const payload = (await request.json().catch(() => null)) as { question?: unknown; options?: unknown } | null;

  try {
    const poll = await createPoll(boardId, board.share_code, payload?.question, payload?.options);
    return NextResponse.json({ ok: true, data: { poll } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "투표를 만들지 못했습니다.";
    return jsonError("poll_failed", message, 400);
  }
}
