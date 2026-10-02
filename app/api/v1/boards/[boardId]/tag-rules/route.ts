import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiError = { ok: false; code: string; message: string };

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>({ ok: false, code, message }, { status });
}

function normalizePattern(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeMatchType(value: unknown) {
  if (value === "contains" || value === "prefix" || value === "regex") {
    return value;
  }
  return null;
}

function normalizePriority(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > 1000) return null;
  return Math.round(num);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const role = normalizeBoardRole(roleResult);
  if (roleError || !role) {
    return jsonError("forbidden", "보드를 볼 수 없습니다.", 403);
  }

  const { data, error } = await supabase
    .from("tag_rules")
    .select("id, board_id, enabled, priority, match_type, pattern, tag_id, tags:tag_id (id, name, color)")
    .eq("board_id", boardId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError("fetch_failed", "규칙을 불러오지 못했습니다.", 400);
  }

  return NextResponse.json({ ok: true, rules: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  let userId: string;
  let role: string | null = null;
  const supabase = createSupabaseServerClient();
  try {
    const { user } = await requireUserApi();
    userId = user.id;
    const { data, error } = await supabase.rpc("board_role", { bid: boardId });
    if (error) {
      return jsonError("role_error", "권한을 확인하지 못했습니다.", 400);
    }
    role = normalizeBoardRole(data);
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  if (role !== "owner" && role !== "editor") {
    return jsonError("forbidden", "규칙을 수정할 권한이 없습니다.", 403);
  }

  const body = (await request.json()) as {
    enabled?: boolean;
    priority?: number;
    match_type?: string;
    pattern?: string;
    tag_id?: string;
  };

  const matchType = normalizeMatchType(body.match_type);
  const priority = normalizePriority(body.priority ?? 100);
  const pattern = normalizePattern(body.pattern);
  const tagId = typeof body.tag_id === "string" ? body.tag_id : null;
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  if (!matchType) {
    return jsonError("invalid_match_type", "contains/prefix/regex 중 선택해주세요.");
  }
  if (priority === null) {
    return jsonError("invalid_priority", "우선순위는 0~1000 사이 숫자여야 합니다.");
  }
  if (!pattern || pattern.length < 1 || pattern.length > 80) {
    return jsonError("invalid_pattern", "패턴은 1~80자로 입력해주세요.");
  }
  if (!tagId) {
    return jsonError("invalid_tag", "적용할 태그를 선택해주세요.");
  }

  const { data: tagRow, error: tagError } = await supabase
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (tagError || !tagRow) {
    return jsonError("invalid_tag", "해당 보드의 태그만 사용할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("tag_rules")
    .insert({
      board_id: boardId,
      enabled,
      priority,
      match_type: matchType,
      pattern,
      tag_id: tagId,
      created_by: userId,
    })
    .select("id, board_id, enabled, priority, match_type, pattern, tag_id, tags:tag_id (id, name, color)")
    .maybeSingle();

  if (error || !data) {
    return jsonError("create_failed", "규칙을 생성하지 못했습니다.", 400);
  }

  await logAudit({
    boardId,
    action: "tag.rule.create",
    targetType: "tag_rule",
    targetId: data.id,
    meta: { matchType, priority },
  });

  return NextResponse.json({ ok: true, rule: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  let userId: string;
  let role: string | null = null;
  const supabase = createSupabaseServerClient();
  try {
    const { user } = await requireUserApi();
    userId = user.id;
    const { data, error } = await supabase.rpc("board_role", { bid: boardId });
    if (error) {
      return jsonError("role_error", "권한을 확인하지 못했습니다.", 400);
    }
    role = normalizeBoardRole(data);
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  if (role !== "owner" && role !== "editor") {
    return jsonError("forbidden", "규칙을 수정할 권한이 없습니다.", 403);
  }

  const body = (await request.json()) as {
    id?: string;
    enabled?: boolean;
    priority?: number;
    match_type?: string;
    pattern?: string;
    tag_id?: string;
  };

  if (!body.id) {
    return jsonError("invalid_id", "규칙을 찾을 수 없습니다.");
  }

  const updates: Record<string, unknown> = {};
  if (body.enabled !== undefined) {
    updates.enabled = Boolean(body.enabled);
  }
  if (body.priority !== undefined) {
    const priority = normalizePriority(body.priority);
    if (priority === null) {
      return jsonError("invalid_priority", "우선순위는 0~1000 사이 숫자여야 합니다.");
    }
    updates.priority = priority;
  }
  if (body.match_type !== undefined) {
    const matchType = normalizeMatchType(body.match_type);
    if (!matchType) {
      return jsonError("invalid_match_type", "contains/prefix/regex 중 선택해주세요.");
    }
    updates.match_type = matchType;
  }
  if (body.pattern !== undefined) {
    const pattern = normalizePattern(body.pattern);
    if (!pattern || pattern.length < 1 || pattern.length > 80) {
      return jsonError("invalid_pattern", "패턴은 1~80자로 입력해주세요.");
    }
    updates.pattern = pattern;
  }
  if (body.tag_id !== undefined) {
    if (typeof body.tag_id !== "string" || body.tag_id.trim().length === 0) {
      return jsonError("invalid_tag", "적용할 태그를 선택해주세요.");
    }
    updates.tag_id = body.tag_id;

    const { data: tagRow, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("id", body.tag_id)
      .eq("board_id", boardId)
      .maybeSingle();
    if (tagError || !tagRow) {
      return jsonError("invalid_tag", "해당 보드의 태그만 사용할 수 있습니다.");
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("invalid_payload", "변경할 내용이 없습니다.");
  }

  const { data, error } = await supabase
    .from("tag_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("board_id", boardId)
    .select("id, board_id, enabled, priority, match_type, pattern, tag_id, tags:tag_id (id, name, color)")
    .maybeSingle();

  if (error) {
    return jsonError("update_failed", "규칙을 수정하지 못했습니다.", 400);
  }

  if (!data) {
    return jsonError("not_found", "규칙을 찾을 수 없습니다.", 404);
  }

  await logAudit({
    boardId,
    action: "tag.rule.update",
    targetType: "tag_rule",
    targetId: data.id,
    meta: { updatedBy: userId },
  });

  return NextResponse.json({ ok: true, rule: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  let role: string | null = null;
  try {
    const { user } = await requireUserApi();
    void user;
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("board_role", { bid: boardId });
    if (error) {
      return jsonError("role_error", "권한을 확인하지 못했습니다.", 400);
    }
    role = normalizeBoardRole(data);
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  if (role !== "owner" && role !== "editor") {
    return jsonError("forbidden", "규칙을 삭제할 권한이 없습니다.", 403);
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return jsonError("invalid_id", "규칙을 찾을 수 없습니다.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("tag_rules").delete().eq("id", body.id).eq("board_id", boardId);
  if (error) {
    return jsonError("delete_failed", "규칙을 삭제하지 못했습니다.", 400);
  }

  await logAudit({
    boardId,
    action: "tag.rule.delete",
    targetType: "tag_rule",
    targetId: body.id,
  });

  return NextResponse.json({ ok: true });
}
