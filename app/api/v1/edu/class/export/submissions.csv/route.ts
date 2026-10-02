import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CANONICAL_ORIGIN = "https://www.gomdory.com";

type AssignmentRow = Database["public"]["Tables"]["edu_assignments"]["Row"] & Record<string, unknown>;
type SubmissionRow = Database["public"]["Tables"]["edu_submissions"]["Row"] & Record<string, unknown>;
type ProjectRow = Database["public"]["Tables"]["edu_projects"]["Row"] & Record<string, unknown>;

function csvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function requireTeacher(boardId: string, requestId: string) {
  try {
    await requireUserApi();
  } catch {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders()),
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !canEditBoard(boardRole)) {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders()),
    };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";

  if (!boardId) {
    return jsonErrorWithRequestId(
      "MISSING_PARAMS",
      "boardId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const access = await requireTeacher(boardId, requestId);
  if (!access.ok) {
    return access.response;
  }

  const admin = createSupabaseAdminClient();
  const { data: assignments, error: assignmentsError } = (await admin
    .from("edu_assignments")
    .select("id, title, lesson_id, due_at, is_closed")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })) as { data: AssignmentRow[] | null; error: { message: string } | null };

  if (assignmentsError) {
    return jsonErrorWithRequestId(
      "ASSIGNMENTS_LOOKUP_FAILED",
      assignmentsError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const assignmentMap = new Map(
    (assignments ?? []).map((assignment) => [
      assignment.id,
      {
        title: assignment.title,
        lessonId: assignment.lesson_id,
        dueAt: assignment.due_at,
        isClosed: assignment.is_closed,
      },
    ]),
  );

  const assignmentIds = Array.from(assignmentMap.keys());
  let submissions: SubmissionRow[] = [];

  if (assignmentIds.length > 0) {
    const { data: submissionRows, error: submissionError } = (await admin
      .from("edu_submissions")
      .select("assignment_id, student_name, slug, created_at")
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false })) as { data: SubmissionRow[] | null; error: { message: string } | null };

    if (submissionError) {
      return jsonErrorWithRequestId(
        "SUBMISSIONS_LOOKUP_FAILED",
        submissionError.message,
        requestId,
        500,
        undefined,
        withNoStoreHeaders(),
      );
    }

    submissions = submissionRows ?? [];
  }

  const slugs = Array.from(new Set(submissions.map((submission) => submission.slug).filter(Boolean)));
  let projectMap = new Map<string, { title: string; createdAt: string; expiresAt: string | null }>();

  if (slugs.length > 0) {
    const { data: projectRows, error: projectError } = (await admin
      .from("edu_projects")
      .select("slug, title, created_at, expires_at")
      .in("slug", slugs)) as { data: ProjectRow[] | null; error: { message: string } | null };

    if (projectError) {
      return jsonErrorWithRequestId(
        "PROJECTS_LOOKUP_FAILED",
        projectError.message,
        requestId,
        500,
        undefined,
        withNoStoreHeaders(),
      );
    }

    projectMap = new Map(
      (projectRows ?? []).map((project) => [
        project.slug,
        { title: project.title, createdAt: project.created_at, expiresAt: project.expires_at },
      ]),
    );
  }

  const publicOrigin = readEduviewOrigin();

  const header = [
    "assignment_title",
    "assignment_id",
    "assignment_lesson_id",
    "assignment_due_at",
    "assignment_is_closed",
    "student_name",
    "project_title",
    "slug",
    "view_url",
    "raw_url",
    "thumb_url",
    "submission_created_at",
    "project_created_at",
    "project_expires_at",
  ];

  const rows = submissions.map((submission) => {
    const assignment = assignmentMap.get(submission.assignment_id);
    const project = projectMap.get(submission.slug);
    const viewUrl = `${CANONICAL_ORIGIN}/edu/view/${submission.slug}/`;
    const rawUrl = `${publicOrigin}/v1/${submission.slug}/`;
    const thumbUrl = `${publicOrigin}/v1/${submission.slug}/thumb.png`;
    const assignmentIsClosed =
      assignment?.isClosed === undefined ? "" : assignment.isClosed ? "true" : "false";
    return [
      assignment?.title ?? "",
      submission.assignment_id,
      assignment?.lessonId ?? "",
      assignment?.dueAt ?? "",
      assignmentIsClosed,
      submission.student_name ?? "",
      project?.title ?? "",
      submission.slug,
      viewUrl,
      rawUrl,
      thumbUrl,
      submission.created_at,
      project?.createdAt ?? "",
      project?.expiresAt ?? "",
    ];
  });

  const csv = [header, ...rows].map((row) => row.map((cell) => csvValue(cell)).join(",")).join("\n");

  const headers = new Headers(withNoStoreHeaders().headers);
  headers.set("content-type", "text/csv; charset=utf-8");
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);

  return new Response(csv, { status: 200, headers });
}
