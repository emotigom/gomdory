import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { appendEvent, SESSION_EVENT_TYPES, type SessionEventType } from "@/lib/data/sessionsReport";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string; sessionId: string }> }) {
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

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => null)) as { type?: string; payload?: unknown } | null;
  const type = body?.type;
  if (!type || !SESSION_EVENT_TYPES.includes(type as SessionEventType)) {
    return jsonError("invalid_type", "지원하지 않는 이벤트입니다.");
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, share_code")
    .eq("id", sessionId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return jsonError("not_found", "세션을 찾을 수 없습니다.", 404);
  }

  try {
    const result = await appendEvent({
      boardId,
      shareCode: sessionRow.share_code as string,
      sessionId,
      type: type as SessionEventType,
      payload: body?.payload,
    });

    if (result.throttled) {
      return jsonError("throttled", "snapshot 이벤트가 제한되었습니다.", 429);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이벤트를 기록하지 못했습니다.";
    return jsonError("event_append_failed", message, 502);
  }
}
