import { NextRequest, NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";
const JOIN_SHORT_ORIGIN = "https://www.gkrry.com";

type StartPayload = {
  boardId?: string;
};

type StartResponse = {
  ok: true;
  shareCode: string;
  joinShortUrl: string;
  courseUrl: string;
  galleryUrl: string;
  reopenedAssignments: number;
  locked: boolean;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

type EduClassUpdatePayload = Database["public"]["Tables"]["edu_classes"]["Update"];
type EduAssignmentUpdatePayload = Database["public"]["Tables"]["edu_assignments"]["Update"];

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
  let payload: StartPayload | null = null;
  try {
    payload = (await request.json()) as StartPayload;
  } catch {
    payload = null;
  }

  const boardId = typeof payload?.boardId === "string" ? payload.boardId.trim() : "";
  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  const access = await requireBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  const admin = createSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("edu_classes")
    .select("share_code, locked_at")
    .eq("board_id", boardId)
    .maybeSingle();

  if (classError) {
    return jsonError(classError.message, 500);
  }

  if (!classRow?.share_code) {
    return jsonError("EDU 수업을 먼저 생성해 주세요.", 404);
  }

  const shareCode = classRow.share_code;

  const { error: lockError } = await admin
    .from("edu_classes")
    .update(toSnakeKeys({ lockedAt: null, lockReason: null }) as EduClassUpdatePayload)
    .eq("board_id", boardId);

  if (lockError) {
    return jsonError(lockError.message, 500);
  }

  const { data: closedAssignments, error: closedAssignmentsError } = await admin
    .from("edu_assignments")
    .select("id")
    .eq("board_id", boardId)
    .eq("is_closed", true);

  if (closedAssignmentsError) {
    return jsonError(closedAssignmentsError.message, 500);
  }

  const closedAssignmentIds = (closedAssignments ?? []).map((row) => row.id).filter(Boolean);

  if (closedAssignmentIds.length > 0) {
    const { error: reopenError } = await admin
      .from("edu_assignments")
      .update(toSnakeKeys({ isClosed: false }) as EduAssignmentUpdatePayload)
      .in("id", closedAssignmentIds);

    if (reopenError) {
      return jsonError(reopenError.message, 500);
    }
  }

  const joinCodeInsert = toSnakeKeys({
    code: shareCode,
    boardId,
    isActive: true,
  }) as Database["public"]["Tables"]["edu_join_codes"]["Insert"];

  const { error: joinCodeError } = await admin
    .from("edu_join_codes")
    .insert(joinCodeInsert)
    .select("code")
    .single();

  if (joinCodeError && joinCodeError.code !== "23505") {
    return jsonError(joinCodeError.message, 500);
  }

  const joinShortUrl = `${JOIN_SHORT_ORIGIN}/s/${shareCode}`;
  const courseUrl = `${CANONICAL_ORIGIN}/edu?code=${shareCode}`;
  const galleryUrl = `${CANONICAL_ORIGIN}/edu/class/${shareCode}/gallery`;

  return NextResponse.json({
    ok: true,
    shareCode,
    joinShortUrl,
    courseUrl,
    galleryUrl,
    reopenedAssignments: closedAssignmentIds.length,
    locked: false,
  } satisfies StartResponse);
}
