import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import {
  STUDENT_APP_SUBMISSION_WINDOW_HOURS,
  getStudentAppSubmissionExpiresAt,
  getStudentAppSubmissionRemainingSeconds,
  isStudentAppSubmissionOpen,
  validateStudentAppAutoPublishWindow,
} from "@/lib/student-apps/submissionWindow";
import { toCamelKeys, toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

type SessionRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  endedAt?: string | null;
  publishMode?: string | null;
};

const toSessionRow = (row: Record<string, unknown>) => toCamelKeys(row) as SessionRow;

const mapSession = (row: SessionRow) => ({
  id: row.id,
  status: row.status,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  expiresAt: row.endsAt,
  isOpen: isStudentAppSubmissionOpen(row),
  remainingSeconds: getStudentAppSubmissionRemainingSeconds(row),
  publishMode: row.publishMode === "auto_publish" ? "auto_publish" : "teacher_review",
});

async function verifyBoardOwner(boardId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const boardRes = await supabase.from("boards").select("id, owner_id").eq("id", boardId).maybeSingle();
  if (boardRes.error || !boardRes.data?.id) return { ok: false as const, code: "board_not_found", message: "보드를 찾을 수 없습니다.", status: 404 };
  if (boardRes.data.owner_id !== userId) return { ok: false as const, code: "forbidden_board", message: "보드 소유자만 사용할 수 있습니다.", status: 403 };
  return { ok: true as const, supabase };
}

export async function GET(request: NextRequest) {
  let userId = "";
  try { userId = (await requireUserApi()).user.id; } catch { return error(401, "unauthorized", "로그인이 필요합니다."); }

  const boardId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!boardId) return error(400, "board_id_required", "boardId가 필요합니다.");

  const verified = await verifyBoardOwner(boardId, userId);
  if (!verified.ok) return error(verified.status, verified.code, verified.message);

  const active = await verified.supabase
    .from("student_app_class_sessions")
    .select("id, status, starts_at, ends_at, ended_at, publish_mode")
    .eq("board_id", boardId)
    .eq("status", "active")
    .is("ended_at", null)
    .gt("ends_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  return Response.json({ ok: true, session: active.data ? mapSession(toSessionRow(active.data as Record<string, unknown>)) : null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let userId = "";
  try { userId = (await requireUserApi()).user.id; } catch { return error(401, "unauthorized", "로그인이 필요합니다."); }

  const body = await request.json().catch(() => null) as { boardId?: string; action?: "start" | "end" | "autoStart" | "startAutoPublish" } | null;
  const boardId = body?.boardId?.trim();
  if (!boardId) return error(400, "board_id_required", "boardId가 필요합니다.");
  if (body?.action !== "start" && body?.action !== "end" && body?.action !== "autoStart" && body?.action !== "startAutoPublish") return error(400, "invalid_action", "지원하지 않는 제출 세션 동작입니다.");

  const verified = await verifyBoardOwner(boardId, userId);
  if (!verified.ok) return error(verified.status, verified.code, verified.message);

  const now = new Date().toISOString();
  const active = await verified.supabase
    .from("student_app_class_sessions")
    .select("id, status, starts_at, ends_at, ended_at, publish_mode")
    .eq("board_id", boardId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  const activeSession = active.data ? toSessionRow(active.data as Record<string, unknown>) : null;
  if (body.action === "autoStart" && activeSession && isStudentAppSubmissionOpen(activeSession, new Date(now))) {
    return Response.json({ ok: true, session: mapSession(activeSession) }, { headers: { "cache-control": "no-store" } });
  }

  const autoPublishWindow = body.action === "startAutoPublish" ? validateStudentAppAutoPublishWindow(new Date(now)) : null;
  if (autoPublishWindow && !autoPublishWindow.ok) {
    const message = autoPublishWindow.reason === "weekly_window_ended"
      ? "이번 주 즉시 공개 제출 기간이 이미 끝났습니다."
      : "즉시 공개 제출 기간은 최대 7일까지 열 수 있습니다.";
    return error(409, autoPublishWindow.reason, message);
  }

  const endPayload = toSnakeKeys({ status: "ended", endedAt: now, updatedAt: now }) as never;
  const ended = await verified.supabase
    .from("student_app_class_sessions")
    .update(endPayload)
    .eq("board_id", boardId)
    .eq("status", "active")
    .is("ended_at", null);
  if (ended.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  if (body.action === "end") return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });

  const endsAt = autoPublishWindow?.endsAt ?? getStudentAppSubmissionExpiresAt(new Date(now), STUDENT_APP_SUBMISSION_WINDOW_HOURS);
  const publishMode = body.action === "startAutoPublish" ? "auto_publish" : "teacher_review";
  const startPayload = toSnakeKeys({ boardId, startedBy: userId, status: "active", startsAt: now, endsAt, publishMode, updatedAt: now }) as never;
  const inserted = await verified.supabase
    .from("student_app_class_sessions")
    .insert(startPayload)
    .select("id, status, starts_at, ends_at, ended_at, publish_mode")
    .maybeSingle();
  if (inserted.error || !inserted.data) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  return Response.json({ ok: true, session: mapSession(toSessionRow(inserted.data as Record<string, unknown>)) }, { headers: { "cache-control": "no-store" } });
}
