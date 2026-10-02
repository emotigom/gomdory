import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { generateShareCode } from "@/lib/data/share";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RotatePayload = {
  boardId?: string;
};

type RotateResponse = {
  ok: true;
  newCode: string;
  joinShortUrl: string;
  courseUrl: string;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

function apiError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message } satisfies ErrorResponse, { status });
}

async function requireBoardAccess(boardId: string) {
  try {
    await requireUserApi();
  } catch {
    return { ok: false as const, response: apiError("인증이 필요합니다.", 401) };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return { ok: false as const, response: apiError("보드를 확인하지 못했습니다.", 404) };
  }

  if (boardRole === "viewer") {
    return { ok: false as const, response: apiError("이 보드에 접근할 수 없습니다.", 403) };
  }

  return { ok: true as const };
}

async function generateJoinCode(admin: ReturnType<typeof createSupabaseAdminClient>, boardId: string) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const newCode = generateShareCode();
    const { error } = await admin
      .from("edu_join_codes")
      .insert({ code: newCode, board_id: boardId, is_active: true })
      .select("code")
      .single();

    if (!error) {
      return newCode;
    }

    if (error.code === "23505") {
      lastError = new Error("share_code_conflict");
      continue;
    }

    lastError = new Error(error.message);
    break;
  }

  throw lastError ?? new Error("share_code_conflict");
}

export async function POST(request: Request): Promise<Response> {
  let boardId = "";
  try {
    const payload = (await request.json().catch(() => null)) as RotatePayload | null;
    boardId = typeof payload?.boardId === "string" ? payload.boardId.trim() : "";
  } catch {
    boardId = "";
  }

  if (!boardId) {
    return apiError("boardId 값이 필요합니다.", 400);
  }

  const access = await requireBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  const admin = createSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("edu_classes")
    .select("board_id")
    .eq("board_id", boardId)
    .maybeSingle();

  if (classError) {
    return apiError(classError.message, 500);
  }

  if (!classRow?.board_id) {
    return apiError("EDU 수업을 찾을 수 없습니다.", 404);
  }

  const revokedAt = new Date().toISOString();
  const { error: revokeError } = await admin
    .from("edu_join_codes")
    .update({ is_active: false, revoked_at: revokedAt })
    .eq("board_id", boardId)
    .eq("is_active", true);

  if (revokeError) {
    return apiError(revokeError.message, 500);
  }

  let newCode = "";
  try {
    newCode = await generateJoinCode(admin, boardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "공유 코드를 생성하지 못했습니다.";
    return apiError(message, 500);
  }

  const { error: updateError } = await admin
    .from("edu_classes")
    .update({ share_code: newCode })
    .eq("board_id", boardId);

  if (updateError) {
    return apiError(updateError.message, 500);
  }

  const response: RotateResponse = {
    ok: true,
    newCode,
    joinShortUrl: `https://www.gkrry.com/s/${newCode}`,
    courseUrl: `https://www.gomdory.com/edu?code=${newCode}`,
  };

  return NextResponse.json(response);
}
