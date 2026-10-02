import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiError = { ok: false; code: string; message: string };

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>({ ok: false, code, message }, { status });
}

function isDuplicateError(error: { code?: string } | null) {
  return error?.code === "23505";
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeColor(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const withCounts = searchParams.get("withCounts") === "1";

  let role: string | null = null;
  try {
    await requireUserApi();
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("board_role", { bid: boardId });
    if (error) {
      return jsonError("role_error", "권한을 확인하지 못했습니다.", 400);
    }
    role = normalizeBoardRole(data);
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  if (!role) {
    return jsonError("forbidden", "보드를 볼 수 없습니다.", 403);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color, created_at")
    .eq("board_id", boardId)
    .order("name", { ascending: true });

  if (error) {
    return jsonError("fetch_failed", "태그를 불러오지 못했습니다.", 500);
  }

  const tags = data ?? [];

  if (!withCounts || tags.length === 0) {
    return NextResponse.json({ ok: true, tags });
  }

  const tagIds = tags.map((tag) => tag.id);
  const { data: cardTagRows, error: countError } = await supabase
    .from("card_tags")
    .select("tag_id, cards!inner(deleted_at)")
    .in("tag_id", tagIds)
    .is("cards.deleted_at", null);

  if (countError) {
    return jsonError("count_failed", "태그를 불러오지 못했습니다.", 500);
  }

  const counts = (cardTagRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const tagId = (row as { tag_id: string | null }).tag_id;
    if (!tagId) return acc;
    acc[tagId] = (acc[tagId] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    tags: tags.map((tag) => ({
      ...tag,
      cardCount: counts[tag.id] ?? 0,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  let role: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
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
    return jsonError("forbidden", "태그를 수정할 권한이 없습니다.", 403);
  }

  const body = (await request.json()) as { name?: string; color?: string | null };
  const name = normalizeName(body.name);
  const color = normalizeColor(body.color);

  if (!name || name.length < 1 || name.length > 32) {
    return jsonError("invalid_name", "태그 이름은 1~32자로 입력해주세요.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tags")
    .insert({
      board_id: boardId,
      name,
      color,
      created_by: userId,
    })
    .select("id, name, color, created_at")
    .maybeSingle();

  if (error) {
    if (isDuplicateError(error)) {
      return jsonError("duplicate", "이미 같은 이름의 태그가 있어요.", 409);
    }
    return jsonError("create_failed", "태그를 생성하지 못했습니다.", 500);
  }

  if (!data) {
    return jsonError("create_failed", "태그를 생성하지 못했습니다.", 500);
  }

  await logAudit({
    boardId,
    action: "tag.create",
    targetType: "tag",
    targetId: data.id,
    meta: { color: data.color },
  });

  return NextResponse.json({ ok: true, tag: data });
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
    return jsonError("forbidden", "태그를 삭제할 권한이 없습니다.", 403);
  }

  const body = (await request.json()) as { tagId?: string };
  const tagId = typeof body.tagId === "string" ? body.tagId : null;

  if (!tagId) {
    return jsonError("invalid_id", "삭제할 태그를 선택해주세요.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("tags").delete().eq("id", tagId).eq("board_id", boardId);

  if (error) {
    return jsonError("delete_failed", "태그를 삭제하지 못했습니다.", 500);
  }

  await logAudit({
    boardId,
    action: "tag.delete",
    targetType: "tag",
    targetId: tagId,
  });

  return NextResponse.json({ ok: true });
}
