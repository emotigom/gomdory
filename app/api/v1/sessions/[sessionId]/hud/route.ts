import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getSessionHudSnapshot } from "@/lib/data/sessionQuestions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function getSessionBoardRole(sessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("board_id")
    .eq("id", sessionId)
    .maybeSingle();

  const boardId = (session as { board_id?: string } | null)?.board_id;
  if (!boardId) return { boardId: null, role: null } as const;

  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const normalized = normalizeBoardRole(role);
  if (roleError) {
    return { boardId, role: null } as const;
  }
  return { boardId, role: normalized } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!UUID_REGEX.test(sessionId)) {
    return jsonError("invalid_params", "세션 ID가 올바르지 않아요.");
  }

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401);
  }

  const { boardId, role } = await getSessionBoardRole(sessionId);
  if (!boardId || !role || role === "viewer") {
    return jsonError("forbidden", "세션을 조회할 권한이 없어요.", 403);
  }

  try {
    const hud = await getSessionHudSnapshot(sessionId);
    return NextResponse.json({ ok: true, data: hud });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HUD 정보를 불러올 수 없어요.";
    return jsonError("server_error", message, 500);
  }
}
