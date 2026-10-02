import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { getTrustedParticipantOwnershipContext } from "@/lib/edu/joinSession";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { selectOwnedSubmissionStatuses, parseSubmissionStatusRequest, type OwnedSubmissionStatusRow } from "@/lib/student-apps/submissionStatusAccess";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, withNoStoreHeaders({ status }));
const empty = () => Response.json({ ok: true, submissions: [] }, withNoStoreHeaders());

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return error(400, "invalid_body", "요청 형식이 올바르지 않습니다."); }
  if (!body || typeof body !== "object" || !("boardId" in body) || typeof body.boardId !== "string" || !body.boardId.trim()) {
    return error(400, "board_id_required", "boardId가 필요합니다.");
  }
  const payload = body as { boardId: string; studentSessionToken?: unknown; guestToken?: unknown };
  const parsed = parseSubmissionStatusRequest(body);
  if (parsed.kind === "legacy") return empty();
  if (parsed.kind === "invalid") return error(400, parsed.code, "제출 상태 요청 형식이 올바르지 않습니다.");
  if (parsed.submissions.length === 0) return empty();

  const sessionToken = typeof payload.studentSessionToken === "string" ? payload.studentSessionToken.trim() : typeof payload.guestToken === "string" ? payload.guestToken.trim() : "";
  // A share code is board entry proof only. It can never satisfy this ownership boundary.
  if (!sessionToken) return empty();
  const ownership = await getTrustedParticipantOwnershipContext(sessionToken, payload.boardId);
  if (!ownership) return empty();

  const supabase = createSupabaseAdminClient();
  try {
    const subject = await getRateLimitSubject(request, ownership.participantOwnerHash);
    const rate = await checkRateLimit(supabase as unknown as Parameters<typeof checkRateLimit>[0], {
      key: `student-apps:status:${payload.boardId}:${subject}`,
      windowSeconds: 600,
      limit: 60,
    });
    if (!rate.ok) return error(429, "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  } catch {
    // The ownership predicate remains mandatory even when the optional limiter backend is unavailable.
  }

  const requestedIds = parsed.submissions.map((submission) => submission.submissionId);
  const result = await supabase
    .from("student_app_submissions")
    .select("id, title, status, teacher_note, reviewed_at, archived_at, created_at, version, is_latest, ownership_version, owner_participant_hash, status_capability_hash")
    .eq("board_id", payload.boardId)
    .eq("owner_participant_hash", ownership.participantOwnerHash)
    .eq("ownership_version", ownership.ownershipVersion)
    .in("id", requestedIds)
    .not("status_capability_hash", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (result.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  const submissions = selectOwnedSubmissionStatuses((result.data ?? []) as OwnedSubmissionStatusRow[], parsed.submissions, ownership.ownershipVersion);
  return Response.json({ ok: true, submissions }, withNoStoreHeaders());
}
