import { NextRequest, NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

type AssignmentRow = Database["public"]["Tables"]["edu_assignments"]["Row"] & Record<string, unknown>;

type SubmissionRow = Database["public"]["Tables"]["edu_submissions"]["Row"] & Record<string, unknown>;

type SubmissionsResponse = {
  ok: true;
  assignment: {
    id: string;
    title: string;
  };
  submissions: Array<{
    studentName: string | null;
    slug: string;
    url: string;
    createdAt: string;
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
  const assignmentId = request.nextUrl.searchParams.get("assignmentId")?.trim() ?? "";
  if (!assignmentId) {
    return jsonError("assignmentId 값이 필요합니다.", 400);
  }

  const admin = createSupabaseAdminClient();
  const { data: assignmentRow, error: assignmentError } = (await admin
    .from("edu_assignments")
    .select("id, board_id, title")
    .eq("id", assignmentId)
    .maybeSingle()) as { data: AssignmentRow | null; error: { message: string } | null };

  if (assignmentError) {
    return jsonError(assignmentError.message, 500);
  }

  if (!assignmentRow) {
    return jsonError("과제를 찾을 수 없습니다.", 404);
  }

  const assignment = toCamelKeys(assignmentRow) as { id: string; boardId: string; title: string };

  const access = await requireBoardAccess(assignment.boardId);
  if (!access.ok) {
    return access.response;
  }

  const { data: submissionsRows, error: submissionsError } = (await admin
    .from("edu_submissions")
    .select("student_name, slug, created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })) as { data: SubmissionRow[] | null; error: { message: string } | null };

  if (submissionsError) {
    return jsonError(submissionsError.message, 500);
  }

  const submissions = (submissionsRows ?? []).map((row) => {
    const submission = toCamelKeys(row) as { studentName: string | null; slug: string; createdAt: string };
    return {
      ...submission,
      url: `${CANONICAL_ORIGIN}/edu/view/${submission.slug}`,
    };
  });

  return NextResponse.json({
    ok: true,
    assignment: { id: assignment.id, title: assignment.title },
    submissions,
  } satisfies SubmissionsResponse);
}
