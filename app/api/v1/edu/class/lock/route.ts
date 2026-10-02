import { NextRequest, NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toCamelKeys, toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LockResponse = {
  ok: true;
  locked: boolean;
  lockedAt: string | null;
  lockReason: string | null;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

type LockPayload = {
  boardId?: string;
  locked?: boolean;
  reason?: string;
};

type EduClassRow = Database["public"]["Tables"]["edu_classes"]["Row"] & Record<string, unknown>;
type EduClassUpdatePayload = Database["public"]["Tables"]["edu_classes"]["Update"];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message } satisfies ErrorResponse, { status });
}

async function requireBoardAccess(boardId: string) {
  try {
    await requireUserApi();
  } catch {
    return { ok: false as const, response: jsonError("인증이 필요합니다.", 401) };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return { ok: false as const, response: jsonError("보드를 확인하지 못했습니다.", 404) };
  }

  if (boardRole === "viewer") {
    return { ok: false as const, response: jsonError("이 보드에 접근할 수 없습니다.", 403) };
  }

  return { ok: true as const };
}

async function resolveClass(boardId: string) {
  const supabase = createSupabaseAdminClient();
  const classSelect = (await supabase
    .from("edu_classes")
    .select("share_code, locked_at, lock_reason")
    .eq("board_id", boardId)
    .maybeSingle()) as { data: EduClassRow | null; error: { message: string } | null };
  const { data, error } = classSelect;

  const classRow = data
    ? (toCamelKeys(data) as { shareCode?: string | null; lockedAt?: string | null; lockReason?: string | null })
    : null;

  if (error) {
    return { ok: false as const, response: jsonError(error.message, 500) };
  }

  if (!classRow?.shareCode) {
    return { ok: false as const, response: jsonError("EDU 수업을 찾을 수 없습니다.", 404) };
  }

  return { ok: true as const, classRow };
}

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";
  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  const access = await requireBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  const classResult = await resolveClass(boardId);
  if (!classResult.ok) {
    return classResult.response;
  }

  const response: LockResponse = {
    ok: true,
    locked: Boolean(classResult.classRow.lockedAt),
    lockedAt: classResult.classRow.lockedAt ?? null,
    lockReason: classResult.classRow.lockReason ?? null,
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  let payload: LockPayload | null = null;
  try {
    payload = (await request.json()) as LockPayload;
  } catch {
    payload = null;
  }

  const boardId = typeof payload?.boardId === "string" ? payload.boardId.trim() : "";
  const locked = typeof payload?.locked === "boolean" ? payload.locked : null;
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";

  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  if (locked === null) {
    return jsonError("locked 값이 필요합니다.", 400);
  }

  const access = await requireBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  const classResult = await resolveClass(boardId);
  if (!classResult.ok) {
    return classResult.response;
  }

  const supabase = createSupabaseAdminClient();
  const lockedAt = locked ? new Date().toISOString() : null;
  const lockReason = locked ? (reason || null) : null;

  const updateResult = (await supabase
    .from("edu_classes")
    .update(toSnakeKeys({ lockedAt, lockReason }) as EduClassUpdatePayload)
    .eq("board_id", boardId)
    .select("locked_at, lock_reason")
    .single()) as { data: EduClassRow | null; error: { message: string } | null };
  const { data, error } = updateResult;

  if (error) {
    return jsonError(error.message, 500);
  }

  const updatedRow = data
    ? (toCamelKeys(data) as { lockedAt?: string | null; lockReason?: string | null })
    : null;

  const response: LockResponse = {
    ok: true,
    locked,
    lockedAt: updatedRow?.lockedAt ?? null,
    lockReason: updatedRow?.lockReason ?? null,
  };

  return NextResponse.json(response);
}
