import { NextRequest, NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ArchivePayload = {
  boardId?: string;
  archive?: boolean;
  ttlDays?: number;
};

type ArchiveResponse = {
  ok: true;
  lockedAt: string | null;
  participantsCount: number;
  projectsCount: number;
  expiresAt: string | null;
  ttlDays: number | null;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

type EduClassUpdatePayload = Database["public"]["Tables"]["edu_classes"]["Update"];
type EduAssignmentUpdatePayload = Database["public"]["Tables"]["edu_assignments"]["Update"];
type EduProjectUpdatePayload = Database["public"]["Tables"]["edu_projects"]["Update"];

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

  if (roleError || !canEditBoard(boardRole)) {
    return { ok: false as const, response: jsonError("이 보드에 접근할 수 없습니다.", 403) };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  let payload: ArchivePayload | null = null;
  try {
    payload = (await request.json()) as ArchivePayload;
  } catch {
    payload = null;
  }

  const boardId = typeof payload?.boardId === "string" ? payload.boardId.trim() : "";
  const archive = payload?.archive === true;
  const ttlDays = payload?.ttlDays;

  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  if (!archive) {
    return jsonError("archive 값이 필요합니다.", 400);
  }

  const access = await requireBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  let normalizedTtlDays: number | null = null;
  if (ttlDays !== undefined) {
    if (typeof ttlDays !== "number" || !Number.isFinite(ttlDays)) {
      return jsonError("ttlDays 값이 올바르지 않습니다.", 400);
    }
    const rounded = Math.floor(ttlDays);
    if (rounded < 1) {
      return jsonError("ttlDays 값이 올바르지 않습니다.", 400);
    }
    normalizedTtlDays = Math.min(rounded, 180);
  }

  const admin = createSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("edu_classes")
    .select("board_id")
    .eq("board_id", boardId)
    .maybeSingle();

  if (classError) {
    return jsonError(classError.message, 500);
  }

  if (!classRow) {
    return jsonError("EDU 수업을 찾을 수 없습니다.", 404);
  }

  const lockedAt = new Date().toISOString();
  const { error: lockError } = await admin
    .from("edu_classes")
    .update(toSnakeKeys({ lockedAt, lockReason: "수업 종료" }) as EduClassUpdatePayload)
    .eq("board_id", boardId);

  if (lockError) {
    return jsonError(lockError.message, 500);
  }

  const { error: assignmentsError } = await admin
    .from("edu_assignments")
    .update(toSnakeKeys({ isClosed: true }) as EduAssignmentUpdatePayload)
    .eq("board_id", boardId);

  if (assignmentsError) {
    return jsonError(assignmentsError.message, 500);
  }

  let expiresAt: string | null = null;
  if (normalizedTtlDays !== null) {
    expiresAt = new Date(Date.now() + normalizedTtlDays * 24 * 60 * 60 * 1000).toISOString();
    const { error: projectsError } = await admin
      .from("edu_projects")
      .update(toSnakeKeys({ expiresAt }) as EduProjectUpdatePayload)
      .eq("board_id", boardId);

    if (projectsError) {
      return jsonError(projectsError.message, 500);
    }
  }

  const { count: participantsCount, error: participantsError } = await admin
    .from("edu_participants")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId);

  if (participantsError) {
    return jsonError(participantsError.message, 500);
  }

  const { count: projectsCount, error: projectsCountError } = await admin
    .from("edu_projects")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId);

  if (projectsCountError) {
    return jsonError(projectsCountError.message, 500);
  }

  return NextResponse.json({
    ok: true,
    lockedAt,
    participantsCount: participantsCount ?? 0,
    projectsCount: projectsCount ?? 0,
    expiresAt,
    ttlDays: normalizedTtlDays,
  } satisfies ArchiveResponse);
}
