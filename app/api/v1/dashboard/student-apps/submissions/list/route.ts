import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAutoPublishBlockingWarnings } from "@/lib/student-apps/autoPublishStudentAppSubmission";

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  let userId = "";
  try { userId = (await requireUserApi()).user.id; } catch { return error(401, "unauthorized", "로그인이 필요합니다."); }

  const boardId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!boardId) return error(400, "board_id_required", "boardId가 필요합니다.");

  const supabase = createSupabaseAdminClient();
  const boardRes = await supabase.from("boards").select("id, owner_id").eq("id", boardId).maybeSingle();
  if (boardRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!boardRes.data || boardRes.data.owner_id !== userId) return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");

  const rawLimit = request.nextUrl.searchParams.get("limit");
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 20;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, parsedLimit)) : 20;

  const rows = await supabase
    .from("student_app_submissions")
    .select("id, title, status, submitted_by_name, student_note, teacher_note, reviewed_at, archived_at, summary, created_at, class_session_id, version, is_latest, previous_submission_id")
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (rows.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  type SubmissionListRow = {
    id: string;
    title: string;
    status: string;
    submittedByName: string | null;
    studentNote: string | null;
    teacherNote: string | null;
    reviewedAt: string | null;
    archivedAt: string | null;
    summary: { fileCount?: number; totalSizeBytes?: number; warnings?: string[] } | null;
    createdAt: string;
    classSessionId: string | null;
    version: number;
    isLatest: boolean;
    previousSubmissionId: string | null;
  };

  return Response.json({
    ok: true,
    submissions: (rows.data ?? []).map((row) => {
      const typedRow = toCamelKeys(row as Record<string, unknown>) as SubmissionListRow;
      return ({
      id: typedRow.id,
      title: typedRow.title,
      status: typedRow.status,
      submittedByName: typedRow.submittedByName,
      studentNote: typedRow.studentNote,
      teacherNote: typedRow.teacherNote,
      reviewedAt: typedRow.reviewedAt,
      archivedAt: typedRow.archivedAt,
      fileCount: typedRow.summary?.fileCount ?? 0,
      totalSizeBytes: typedRow.summary?.totalSizeBytes ?? 0,
      warningsCount: Array.isArray(typedRow.summary?.warnings) ? typedRow.summary.warnings.length : 0,
      requiresTeacherReview: getAutoPublishBlockingWarnings(typedRow.summary?.warnings).length > 0,
      createdAt: typedRow.createdAt,
    classSessionId: typedRow.classSessionId,
    version: typedRow.version,
    isLatest: typedRow.isLatest,
    previousSubmissionId: typedRow.previousSubmissionId,
    });
    }),
  }, { status: 200, headers: { "cache-control": "no-store" } });
}
