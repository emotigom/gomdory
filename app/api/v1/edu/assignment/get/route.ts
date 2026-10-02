import { NextRequest, NextResponse } from "next/server";

import { toCamelKeys } from "@/lib/standards/fields";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

type AssignmentRow = Database["public"]["Tables"]["edu_assignments"]["Row"] & Record<string, unknown>;

type AssignmentResponse = {
  ok: true;
  assignment: {
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
  };
};

type ErrorResponse = {
  ok: false;
  message: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message } satisfies ErrorResponse, { status });
}

export async function GET(request: NextRequest) {
  const assignmentId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!assignmentId) {
    return jsonError("id 값이 필요합니다.", 400);
  }

  const shareCode = normalizeShareCode(request.nextUrl.searchParams.get("code") ?? "");
  if (!shareCode) {
    return jsonError("shareCode 값이 필요합니다.", 401);
  }

  if (!isLikelyShareCode(shareCode)) {
    return jsonError("shareCode 값이 유효하지 않습니다.", 400);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .from("edu_assignments")
    .select("id, board_id, share_code, title, lesson_id, template_key, allow_network, due_at, created_at, is_closed")
    .eq("id", assignmentId)
    .maybeSingle()) as { data: AssignmentRow | null; error: { message: string } | null };

  if (error) {
    return jsonError(error.message, 500);
  }

  if (!data) {
    return jsonError("과제를 찾을 수 없습니다.", 404);
  }

  const assignment = toCamelKeys(data) as {
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

  if (assignment.shareCode !== shareCode) {
    return jsonError("과제 접근 권한이 없습니다.", 403);
  }

  const startUrl = `${CANONICAL_ORIGIN}/edu/assignment/${assignment.id}?code=${assignment.shareCode}`;

  return NextResponse.json({
    ok: true,
    assignment: {
      ...assignment,
      startUrl,
    },
  } satisfies AssignmentResponse);
}
