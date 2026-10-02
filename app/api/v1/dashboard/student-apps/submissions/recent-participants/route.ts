import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LOOKBACK_MINUTES = 30;
const MAX_ROWS = 200;
const DISPLAY_NAME_MAX = 20;

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

const looksLikeEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
const looksLikePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && /(?:\+?\d[\d\s().-]{7,})/.test(value);
};

const sanitizeDisplayName = (value: string | null | undefined, anonymousIndex: number) => {
  const cleaned = (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || looksLikeEmail(cleaned) || looksLikePhone(cleaned)) return `익명 참가자 ${anonymousIndex}`;
  return cleaned.length > DISPLAY_NAME_MAX ? `${cleaned.slice(0, DISPLAY_NAME_MAX)}…` : cleaned;
};

type SubmissionParticipantRow = {
  id: string;
  submittedByName: string | null;
  authorClientId: string | null;
  appKey: string | null;
  classSessionId: string | null;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  let userId = "";
  try { userId = (await requireUserApi()).user.id; } catch { return error(401, "unauthorized", "로그인이 필요합니다."); }

  const boardId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!boardId) return error(400, "board_id_required", "boardId가 필요합니다.");

  const supabase = createSupabaseAdminClient();
  const boardRes = await supabase.from("boards").select("id, owner_id").eq("id", boardId).maybeSingle();
  if (boardRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  if (!boardRes.data || boardRes.data.owner_id !== userId) return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");

  const now = new Date();
  const cutoff = new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
  const activeSessionRes = await supabase
    .from("student_app_class_sessions")
    .select("id")
    .eq("board_id", boardId)
    .eq("status", "active")
    .is("ended_at", null)
    .gt("ends_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (activeSessionRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  let query = supabase
    .from("student_app_submissions")
    .select("id, submitted_by_name, author_client_id, app_key, class_session_id, created_at")
    .eq("board_id", boardId)
    .in("status", ["submitted", "accepted", "needs_fix"])
    .is("deleted_at", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const activeClassSessionId = activeSessionRes.data?.id ?? null;
  if (activeClassSessionId) query = query.eq("class_session_id", activeClassSessionId);

  const rowsRes = await query;
  if (rowsRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  const participants: Array<{ id: string; displayName: string; submittedAt: string }> = [];
  const seen = new Set<string>();
  let anonymousIndex = 1;

  for (const rawRow of rowsRes.data ?? []) {
    const row = toCamelKeys(rawRow as Record<string, unknown>) as SubmissionParticipantRow;
    const fallbackName = (row.submittedByName ?? "").trim().toLowerCase();
    const dedupeKey = row.authorClientId?.trim()
      ? `author:${row.authorClientId.trim()}`
      : fallbackName
        ? `name:${fallbackName}`
        : `submission:${row.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const displayName = sanitizeDisplayName(row.submittedByName, anonymousIndex);
    if (displayName.startsWith("익명 참가자 ")) anonymousIndex += 1;
    participants.push({ id: dedupeKey, displayName, submittedAt: row.createdAt });
  }

  return Response.json({
    ok: true,
    participants,
    lookbackMinutes: LOOKBACK_MINUTES,
    classSessionId: activeClassSessionId,
    generatedAt: now.toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
