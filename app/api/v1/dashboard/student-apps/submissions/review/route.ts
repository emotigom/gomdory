import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toCamelKeys, toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

type ReviewAction = "needs_fix" | "accepted" | "archived" | "reopen";

export async function POST(request: NextRequest) {
  let userId = "";
  try { userId = (await requireUserApi()).user.id; } catch { return error(401, "unauthorized", "로그인이 필요합니다."); }

  const body = (await request.json().catch(() => null)) as { boardId?: string; submissionId?: string; action?: ReviewAction; teacherNote?: string | null } | null;
  const boardId = body?.boardId?.trim();
  const submissionId = body?.submissionId?.trim();
  const action = body?.action;
  if (!boardId || !submissionId || !action) return error(400, "invalid_request", "boardId, submissionId, action이 필요합니다.");
  if (!(["needs_fix", "accepted", "archived", "reopen"] as const).includes(action)) return error(400, "invalid_action", "지원하지 않는 상태 변경입니다.");

  const teacherNote = typeof body?.teacherNote === "string" ? body.teacherNote.slice(0, 500) : null;
  const supabase = createSupabaseAdminClient();

  const boardRes = await supabase.from("boards").select("id, owner_id").eq("id", boardId).maybeSingle();
  if (boardRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!boardRes.data || boardRes.data.owner_id !== userId) return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");

  const submissionRes = await supabase.from("student_app_submissions").select("id, is_latest").eq("id", submissionId).eq("board_id", boardId).is("deleted_at", null).maybeSingle();
  if (submissionRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!submissionRes.data) return error(404, "not_found", "제출물을 찾을 수 없습니다.");
  const submission = toCamelKeys(submissionRes.data as Record<string, unknown>) as { id: string; isLatest: boolean | null };
  if (action === "accepted" && submission.isLatest !== true) {
    return error(409, "latest_submission_required", "최신 제출물만 친구 작품 보기에 공개할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const patch: { status: "submitted" | "needs_fix" | "accepted" | "archived"; teacherNote?: string | null; reviewedAt?: string | null; archivedAt?: string | null } =
    action === "needs_fix" ? { status: "needs_fix", teacherNote, reviewedAt: now } :
    action === "accepted" ? { status: "accepted", teacherNote, reviewedAt: now, archivedAt: null } :
    action === "archived" ? { status: "archived", teacherNote, reviewedAt: now, archivedAt: now } :
    { status: "submitted", archivedAt: null, reviewedAt: null };

  const updateRes = await supabase
    .from("student_app_submissions")
    .update(toSnakeKeys(patch) as never)
    .eq("id", submissionId)
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .select("id, status, teacher_note, reviewed_at, archived_at")
    .maybeSingle();

  if (updateRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!updateRes.data) return error(404, "not_found", "제출물을 찾을 수 없습니다.");
  const updated = toCamelKeys(updateRes.data as Record<string, unknown>) as { id: string; status: string; teacherNote: string | null; reviewedAt: string | null; archivedAt: string | null };

  return Response.json({ ok: true, submission: { id: updated.id, status: updated.status, teacherNote: updated.teacherNote, reviewedAt: updated.reviewedAt, archivedAt: updated.archivedAt } }, { headers: { "cache-control": "no-store" } });
}
