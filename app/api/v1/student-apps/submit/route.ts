import { NextRequest } from "next/server";

import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StudentAppDryRunBadRequestError } from "@/lib/student-apps/staticAppDryRun";
import { createStudentAppSubmission } from "@/lib/student-apps/createStudentAppSubmission";
import { getEduBucketFromRuntimeEnv } from "@/lib/cloudflare/getCloudflareRuntimeEnv";
import { getEduJoinSessionSafe, getTrustedParticipantOwnershipContext } from "@/lib/edu/joinSession";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { isStudentAppSubmissionOpen } from "@/lib/student-apps/submissionWindow";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { STUDENT_APP_MAX_REQUEST_CONTENT_LENGTH } from "@/lib/student-apps/fileRules";
import { autoPublishStudentAppSubmission } from "@/lib/student-apps/autoPublishStudentAppSubmission";

const SUBMITTED_BY_NAME_MAX = 40;
const STUDENT_NOTE_MAX = 500;
const ALLOWED_ORIGIN_HOSTS = new Set(["gomdory.com", "www.gomdory.com", "gkrry.com", "www.gkrry.com", "localhost"]);
const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    const originHost = (() => {
      try { return new URL(originHeader).hostname.toLowerCase(); } catch { return ""; }
    })();
    if (originHost && !ALLOWED_ORIGIN_HOSTS.has(originHost) && !originHost.startsWith("localhost:")) {
      return error(403, "invalid_origin", "허용되지 않은 origin입니다.");
    }
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > STUDENT_APP_MAX_REQUEST_CONTENT_LENGTH) {
    return error(413, "payload_too_large", "요청 크기가 너무 큽니다. 전체 20MB 이하로 줄여주세요.");
  }

  let body: unknown;
  try { body = await request.json(); } catch { return error(400, "invalid_body", "요청 형식이 올바르지 않습니다."); }
  if (!body || typeof body !== "object" || !("boardId" in body) || typeof body.boardId !== "string") {
    return error(400, "board_id_required", "boardId가 필요합니다.");
  }
  if (!("source" in body) || body.source !== "manual_files") return error(400, "invalid_source", "source는 manual_files만 지원합니다.");

  const payload = body as { boardId: string; wallId?: string | null; cardId?: string | null; classId?: string | null; submittedByName?: string | null; studentNote?: string | null; authorClientId?: string | null; shareCode?: string | null; accessCode?: string | null; guestToken?: string | null; studentSessionToken?: string | null; files?: unknown[] };
  if (!Array.isArray(payload.files) || payload.files.length === 0) return error(400, "invalid_files", "files는 1개 이상이어야 합니다.");
  if ((payload.submittedByName ?? "").length > SUBMITTED_BY_NAME_MAX) return error(400, "submitted_by_name_too_long", "submittedByName은 40자 이하여야 합니다.");
  if ((payload.studentNote ?? "").length > STUDENT_NOTE_MAX) return error(400, "student_note_too_long", "studentNote는 500자 이하여야 합니다.");

  const trimmedAuthorClientId = typeof payload.authorClientId === "string" ? payload.authorClientId.trim() : "";
  const authorClientId = trimmedAuthorClientId.length > 0 ? trimmedAuthorClientId : null;
  const authorClientIdValid = !authorClientId || ((authorClientId.length >= 8 && authorClientId.length <= 128) && (/^[a-zA-Z0-9_-]+$/.test(authorClientId) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authorClientId)));
  if (!authorClientIdValid) return error(400, "invalid_author_id", "authorClientId 형식이 올바르지 않습니다.");

  const shareCode = normalizeShareCode(typeof payload.shareCode === "string" ? payload.shareCode : typeof payload.accessCode === "string" ? payload.accessCode : "");
  const sessionToken = typeof payload.studentSessionToken === "string" ? payload.studentSessionToken.trim() : typeof payload.guestToken === "string" ? payload.guestToken.trim() : "";
  let trustedOwnership: { version: number; participantOwnerHash: string } | null = null;
  if (!shareCode && !sessionToken) return error(400, "access_required", "공유코드 또는 학생 입장 세션이 필요합니다.");

  const supabase = createSupabaseAdminClient();
  const boardRes = await supabase.from("boards").select("id, share_code, share_enabled").eq("id", payload.boardId).maybeSingle();
  if (boardRes.error || !boardRes.data?.id) return error(404, "board_not_found", "보드를 찾을 수 없습니다.");
  const board = toCamelKeys(boardRes.data as Record<string, unknown>) as { id: string; shareCode: string | null; shareEnabled: boolean | null };

  const classRes = await supabase.from("edu_classes").select("board_id, locked_at").eq("board_id", payload.boardId).maybeSingle();
  if (classRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  const classRow = classRes.data ? toCamelKeys(classRes.data as Record<string, unknown>) as { boardId: string; lockedAt: string | null } : null;
  if (classRow?.lockedAt) return error(403, "submissions_disabled", "학생 제출이 비활성화된 수업입니다.");

  if (sessionToken) {
    const session = await getEduJoinSessionSafe(sessionToken);
    if (session.state !== "resolved" || !session.session?.shareCode || !session.session?.boardId || session.session.boardId !== payload.boardId) {
      return error(403, "invalid_board_access", "유효한 학생 입장 세션이 아닙니다.");
    }
    const ownership = await getTrustedParticipantOwnershipContext(sessionToken, payload.boardId);
    trustedOwnership = ownership
      ? { version: ownership.ownershipVersion, participantOwnerHash: ownership.participantOwnerHash }
      : null;
  } else {
    if (!isLikelyShareCode(shareCode)) return error(400, "access_required", "유효한 공유코드가 필요합니다.");
    const boardShareMatches = normalizeShareCode(board.shareCode ?? "") === shareCode && board.shareEnabled === true;
    if (!boardShareMatches) {
      const joinCodeRes = await supabase.from("edu_join_codes").select("code, board_id, is_active, revoked_at").eq("code", shareCode).eq("board_id", payload.boardId).eq("is_active", true).is("revoked_at", null).maybeSingle();
      const joinCode = joinCodeRes.data ? toCamelKeys(joinCodeRes.data as Record<string, unknown>) as { code: string; boardId: string } : null;
      if (joinCodeRes.error || !joinCode?.boardId) return error(403, "invalid_board_access", "보드 접근 코드가 유효하지 않습니다.");
    }
  }

  const activeSessionRes = await supabase.from("student_app_class_sessions").select("id, status, starts_at, ends_at, ended_at").eq("board_id", payload.boardId).eq("status", "active").is("ended_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (activeSessionRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  const activeSession = activeSessionRes.data ? toCamelKeys(activeSessionRes.data as Record<string, unknown>) as { id: string; status: string; startsAt: string; endsAt: string; endedAt: string | null } : null;
  if (!activeSession?.id || !isStudentAppSubmissionOpen(activeSession)) return error(403, "session_closed", "지금은 학생 앱 제출이 닫혀 있어요. 선생님께 제출을 열어 달라고 해 주세요.");
  const classSessionId = activeSession.id;

  try {
    const subject = await getRateLimitSubject(request, null);
    const identity = sessionToken || shareCode || "no-proof";
    const rateResult = await checkRateLimit(supabase as unknown as Parameters<typeof checkRateLimit>[0], { key: `student-apps:submit:${payload.boardId}:${identity}:${subject}`, windowSeconds: 600, limit: 10 });
    if (!rateResult.ok) return error(429, "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  } catch {
    // allow on rate limit backend failure
  }

  const eduBucket = getEduBucketFromRuntimeEnv();
  if (!eduBucket) return error(503, "storage_unavailable", "스토리지를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.");

  try {
    const result = await createStudentAppSubmission({
      bucket: eduBucket,
      supabase: supabase as unknown as Parameters<typeof createStudentAppSubmission>[0]["supabase"],
      boardId: payload.boardId,
      wallId: payload.wallId ?? null,
      cardId: payload.cardId ?? null,
      classId: payload.classId ?? null,
      submittedByName: payload.submittedByName ?? null,
      studentNote: payload.studentNote ?? null,
      classSessionId,
      authorClientId,
      ownership: trustedOwnership,
      rawPayload: body,
    });
    if (!result.ok && result.reason === "validation_failed") {
      const normalizedErrors = result.dryRun.normalized.errors ?? [];
      return Response.json(
        {
          ...result,
          errors: [...normalizedErrors, ...result.dryRun.validation.errors],
          warnings: [
            ...result.dryRun.normalized.warnings,
            ...result.dryRun.validation.manifest.safety.warnings,
          ],
        },
        { status: 422, headers: { "cache-control": "no-store" } },
      );
    }
    if (!result.ok) return Response.json(result, { status: 200, headers: { "cache-control": "no-store" } });

    const autoPublish = await autoPublishStudentAppSubmission({
      bucket: eduBucket,
      supabase: supabase as unknown as Parameters<typeof autoPublishStudentAppSubmission>[0]["supabase"],
      boardId: payload.boardId,
      submissionId: result.submission.id,
      wallId: payload.wallId ?? null,
      cardId: payload.cardId ?? null,
      classId: payload.classId ?? null,
      rawPayload: body,
      safety: result.safety,
    });
    return Response.json({ ...result, autoPublish }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof StudentAppDryRunBadRequestError) return error(400, err.message || "invalid_body", "요청 형식이 올바르지 않습니다.");
    const code = (err as { code?: string })?.code;
    if (code === "forbidden_board") return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");
    if (code === "storage_unavailable") return error(503, "storage_unavailable", "스토리지를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.");
    if (code === "storage_schema_unavailable") return error(503, "storage_schema_unavailable", "제출 저장소를 사용할 수 없습니다.");
    return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  }
}
