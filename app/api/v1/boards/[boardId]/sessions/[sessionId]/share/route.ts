import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateReportShare } from "@/lib/data/sessionReportShares";
import { buildStudentUrl } from "@/lib/http/publicLinks";
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

  const { data: sessionRow, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return jsonError("not_found", "세션을 찾을 수 없습니다.", 404);
  }

  try {
    const share = await getOrCreateReportShare({ boardId, sessionId });
    const url = buildStudentUrl(`/r/${share.token}`);

    return NextResponse.json({
      ok: true,
      data: {
        url,
        token: share.token,
        expiresAt: share.expires_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "공유 링크를 만들 수 없습니다.";
    return jsonError("share_create_failed", message, 502);
  }
}
