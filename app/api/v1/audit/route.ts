import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { listBoardsForUser } from "@/lib/data/boards.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const boardIdParam = searchParams.get("boardId");
  const actionPrefix = searchParams.get("actionPrefix") ?? undefined;
  const startParam = parseDate(searchParams.get("start"));
  const endParam = parseDate(searchParams.get("end"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 200)
    : 200;

  const supabase = createSupabaseServerClient();

  if (boardIdParam) {
    const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardIdParam });
    const boardRole = normalizeBoardRole(role);

    if (roleError || !boardRole) {
      return jsonError("forbidden", "보드 접근 권한이 없습니다.", 403);
    }
  }

  const boards = boardIdParam
    ? []
    : await listBoardsForUser({ supabase, userId: userId ?? "" });
  const boardIds = boardIdParam ? [boardIdParam] : boards.map((board) => board.id);

  let query = supabase
    .from("audit_logs")
    .select(
      "id, created_at, board_id, actor_user_id, actor_role, action, target_type, target_id, meta, request_id, ip, user_agent",
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (boardIds.length > 0) {
    const idList = boardIds.join(",");
    if (userId) {
      query = query.or(`board_id.in.(${idList}),and(board_id.is.null,actor_user_id.eq.${userId})`);
    } else {
      query = query.in("board_id", boardIds);
    }
  } else if (userId) {
    query = query.eq("actor_user_id", userId).is("board_id", null);
  }

  if (actionPrefix) {
    query = query.like("action", `${actionPrefix}%`);
  }

  if (startParam) {
    query = query.gte("created_at", startParam);
  }

  if (endParam) {
    query = query.lte("created_at", endParam);
  }

  const { data, error } = await query;

  if (error) {
    return jsonError("query_failed", "감사 로그를 불러오지 못했습니다.", 500);
  }

  const items = (data ?? []).slice(0, limit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    boardId: row.board_id,
    actorUserId: row.actor_user_id,
    actorRole: normalizeBoardRole(row.actor_role),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    meta: row.meta,
    requestId: row.request_id,
    ip: row.ip,
    userAgent: row.user_agent,
  }));
  const nextCursor = (data ?? []).length > limit && items.length
    ? items[items.length - 1]?.createdAt ?? null
    : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}
