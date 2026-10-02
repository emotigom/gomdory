import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { savePresentFollowState } from "@/lib/present/presentStateServer";
import { normalizeFollowStateInput } from "@/lib/present/followState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 400);
  }

  if (!boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "발표 상태를 변경할 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    boardId?: string;
    wallId?: string | null;
    focusedCardId?: string | null;
    mode?: string;
  };

  const normalized = normalizeFollowStateInput({
    ...body,
    boardId,
    updatedBy: userId ?? "teacher",
  });

  if (!normalized) {
    return jsonError("invalid_payload", "발표 상태를 저장하지 못했습니다.", 400);
  }

  const result = await savePresentFollowState(normalized);

  if (!result.ok) {
    return jsonError("upstream_failed", "발표 상태를 업데이트하지 못했습니다.", 502);
  }

  await logAudit({
    boardId,
    action: "present.follow.update",
    targetType: "board",
    targetId: boardId,
    meta: {
      wallId: normalized.wallId,
      focusedCardId: normalized.focusedCardId,
      mode: normalized.mode,
    },
  });

  return NextResponse.json({ ok: true });
}
