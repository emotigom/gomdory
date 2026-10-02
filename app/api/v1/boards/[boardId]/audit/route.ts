import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  let actorUserId: string | null = null;
  try {
    const { user } = await requireUserApi();
    actorUserId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const actionPrefix = searchParams.get("actionPrefix") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const actorParam = searchParams.get("actor") ?? undefined;
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 20;

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const normalizedRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 400);
  }

  if (!normalizedRole) {
    return jsonError("forbidden", "보드 접근 권한이 없습니다.", 403);
  }

  let query = supabase
    .from("audit_logs")
    .select(
      "id, created_at, board_id, actor_user_id, actor_role, action, target_type, target_id, meta, request_id",
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (actionPrefix) {
    query = query.like("action", `${actionPrefix}%`);
  }

  if (actorParam === "me" && actorUserId) {
    query = query.eq("actor_user_id", actorUserId);
  }

  const { data, error } = await query;

  if (error) {
    return jsonError("query_failed", "감사 로그를 불러오지 못했습니다.", 500);
  }

  const items = (data ?? []).slice(0, limit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    actorRole: normalizeBoardRole(row.actor_role),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    meta: row.meta,
    requestId: row.request_id,
  }));
  const nextCursor = (data ?? []).length > limit && items.length
    ? items[items.length - 1]?.createdAt ?? null
    : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}
