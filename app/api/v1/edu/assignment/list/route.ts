import { NextRequest, NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

type AssignmentRow = Database["public"]["Tables"]["edu_assignments"]["Row"] & Record<string, unknown>;

type AssignmentListResponse = {
  ok: true;
  assignments: Array<{
    id: string;
    boardId: string;
    shareCode: string;
    title: string;
    lessonId: number;
    templateKey: string;
    allowNetwork: boolean;
    dueAt: string | null;
    createdAt: string;
    isClosed: boolean;
    startUrl: string;
  }>;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

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

export async function GET(request: NextRequest) {
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";
  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  const access = await requireBoardAccess(boardId);
  if (!access.ok) {
    return access.response;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("edu_assignments")
    .select("id, board_id, share_code, title, lesson_id, template_key, allow_network, due_at, created_at, is_closed")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })) as { data: AssignmentRow[] | null; error: { message: string } | null };

  if (error) {
    return jsonError(error.message, 500);
  }

  const assignments = (data ?? []).map((row) => {
    const assignment = toCamelKeys(row) as {
      id: string;
      boardId: string;
      shareCode: string;
      title: string;
      lessonId: number;
      templateKey: string;
      allowNetwork: boolean;
      dueAt: string | null;
      createdAt: string;
      isClosed: boolean;
    };
    return {
      ...assignment,
      startUrl: `${CANONICAL_ORIGIN}/edu/assignment/${assignment.id}?code=${assignment.shareCode}`,
    };
  });

  return NextResponse.json({ ok: true, assignments } satisfies AssignmentListResponse);
}
