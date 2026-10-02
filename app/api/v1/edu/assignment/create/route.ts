import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { EDU_TEMPLATE_OPTIONS } from "@/lib/edu/lessons";
import { generateShareCode } from "@/lib/data/share";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

const VALID_LESSON_IDS = new Set([1, 2, 3, 4]);

type CreateAssignmentPayload = {
  boardId?: string;
  title?: string;
  lessonId?: number;
  templateKey?: string;
  allowNetwork?: boolean;
  dueAt?: string | null;
};

type CreateAssignmentResponse = {
  ok: true;
  assignmentId: string;
  startUrl: string;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message } satisfies ErrorResponse, { status });
}

async function ensureBoardAccess(boardId: string) {
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

async function ensureEduShareCode(boardId: string) {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("edu_classes")
    .select("share_code")
    .eq("board_id", boardId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.share_code) {
    await ensureEduJoinCode(admin, boardId, existing.share_code);
    return existing.share_code;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareCode = generateShareCode();
    const { error: insertError } = await admin
      .from("edu_classes")
      .insert({ board_id: boardId, share_code: shareCode })
      .select("share_code")
      .single();

    if (!insertError) {
      await ensureEduJoinCode(admin, boardId, shareCode);
      return shareCode;
    }

    if (insertError.code === "23505") {
      const { data: row } = await admin
        .from("edu_classes")
        .select("share_code")
        .eq("board_id", boardId)
        .maybeSingle();

      if (row?.share_code) {
        await ensureEduJoinCode(admin, boardId, row.share_code);
        return row.share_code;
      }
      lastError = new Error("share_code_conflict");
      continue;
    }

    lastError = new Error(insertError.message);
    break;
  }

  throw lastError ?? new Error("share_code_conflict");
}

async function ensureEduJoinCode(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  boardId: string,
  shareCode: string,
) {
  const { error } = await admin
    .from("edu_join_codes")
    .insert({ code: shareCode, board_id: boardId, is_active: true })
    .select("code")
    .single();

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function POST(request: Request): Promise<Response> {
  let payload: CreateAssignmentPayload | null = null;
  try {
    payload = (await request.json().catch(() => null)) as CreateAssignmentPayload | null;
  } catch {
    payload = null;
  }

  const boardId = typeof payload?.boardId === "string" ? payload.boardId.trim() : "";
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const rawLessonId = typeof payload?.lessonId === "string" ? Number(payload.lessonId) : payload?.lessonId;
  const lessonId = Number.isFinite(rawLessonId) ? Number(rawLessonId) : null;
  const templateKey = typeof payload?.templateKey === "string" ? payload.templateKey.trim() : "";
  const allowNetwork = typeof payload?.allowNetwork === "boolean" ? payload.allowNetwork : false;
  const dueAt = typeof payload?.dueAt === "string" && payload.dueAt.trim() ? payload.dueAt.trim() : null;

  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  if (!title) {
    return jsonError("과제 제목을 입력해주세요.", 400);
  }

  if (!lessonId || !VALID_LESSON_IDS.has(lessonId)) {
    return jsonError("lessonId 값이 필요합니다.", 400);
  }

  if (!templateKey) {
    return jsonError("templateKey 값이 필요합니다.", 400);
  }

  const templateMatch = EDU_TEMPLATE_OPTIONS.some(
    (option) => option.key === templateKey && option.lessonId === lessonId,
  );
  if (!templateMatch) {
    return jsonError("templateKey 값이 유효하지 않습니다.", 400);
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  let shareCode = "";
  try {
    shareCode = await ensureEduShareCode(boardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "EDU 코드를 생성하지 못했습니다.";
    return jsonError(message, 500);
  }

  const admin = createSupabaseAdminClient();
  const insertPayload = toSnakeKeys({
    boardId,
    shareCode,
    title,
    lessonId,
    templateKey,
    allowNetwork,
    dueAt,
  }) as Database["public"]["Tables"]["edu_assignments"]["Insert"];

  const { data, error } = await admin
    .from("edu_assignments")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    return jsonError(error?.message ?? "과제를 생성하지 못했습니다.", 500);
  }

  const startUrl = `${CANONICAL_ORIGIN}/edu/assignment/${data.id}?code=${shareCode}`;

  return NextResponse.json({
    ok: true,
    assignmentId: data.id,
    startUrl,
  } satisfies CreateAssignmentResponse);
}
