import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { createEduJoinSession, updateEduJoinSessionNickname } from "@/lib/edu/joinSession";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { validateStudentText, ValidationError } from "@/lib/safety/validateStudentText";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const JOIN_TOKEN_REGEX = /^[A-Za-z0-9_-]{8,64}$/;
const NICKNAME_LIMIT = 20;

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as
    | { shareCode?: unknown; nickname?: unknown }
    | null;

  if (!payload) {
    return jsonErrorWithRequestId(
      "INVALID_PAYLOAD",
      "invalid_payload",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const shareCode = normalizeShareCode(typeof payload.shareCode === "string" ? payload.shareCode : "");
  if (!isLikelyShareCode(shareCode)) {
    return jsonErrorWithRequestId(
      "INVALID_SHARE_CODE",
      "invalid_share_code",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const rawNickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  let nickname: string | null = null;
  if (rawNickname) {
    try {
      nickname = validateStudentText(rawNickname, {
        maxLength: NICKNAME_LIMIT,
        minLength: 1,
        maxLines: 1,
      }).text;
    } catch (error) {
      const status = error instanceof ValidationError ? error.status : 400;
      return jsonErrorWithRequestId(
        "INVALID_NICKNAME",
        "invalid_nickname",
        requestId,
        status,
        undefined,
        withNoStoreHeaders(),
      );
    }
  }

  const subject = await getRateLimitSubject(request, null);
  let rateLimitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    rateLimitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:join-session:${subject}`,
        windowSeconds: 60,
        limit: 40,
      },
    );
  } catch {
    rateLimitResult = null;
  }

  if (rateLimitResult && !rateLimitResult.ok) {
    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: rateLimitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }),
    );
  }

  const supabase = createSupabaseAdminClient();
  const joinCodeSelect = (await supabase
    .from("edu_join_codes")
    .select("code, board_id, is_active, revoked_at")
    .eq("code", shareCode)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle()) as {
    data: { code?: string | null; board_id?: string | null } | null;
    error: { message: string } | null;
  };

  if (joinCodeSelect.error || !joinCodeSelect.data?.board_id) {
    return jsonErrorWithRequestId(
      "CLASS_NOT_FOUND",
      "class_not_found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const classSelect = (await supabase
    .from("edu_classes")
    .select("locked_at")
    .eq("board_id", joinCodeSelect.data.board_id)
    .maybeSingle()) as {
    data: { locked_at?: string | null } | null;
    error: { message: string } | null;
  };

  if (classSelect.error || !classSelect.data) {
    return jsonErrorWithRequestId(
      "CLASS_NOT_FOUND",
      "class_not_found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (classSelect.data.locked_at) {
    return jsonErrorWithRequestId(
      "CLASS_LOCKED",
      "class_locked",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const token = await createEduJoinSession({
    shareCode,
    nickname,
    boardId: joinCodeSelect.data.board_id ?? null,
  });

  if (!token) {
    return jsonErrorWithRequestId(
      "JOIN_SESSION_FAILED",
      "join_session_failed",
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  return jsonOkWithRequestId(
    { ok: true, token, boardId: joinCodeSelect.data.board_id ?? null },
    requestId,
    withNoStoreHeaders(),
  );
}

export async function PATCH(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as { token?: unknown; nickname?: unknown } | null;

  if (!payload) {
    return jsonErrorWithRequestId(
      "INVALID_PAYLOAD",
      "invalid_payload",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token || !JOIN_TOKEN_REGEX.test(token)) {
    return jsonErrorWithRequestId(
      "INVALID_TOKEN",
      "invalid_token",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const rawNickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  if (!rawNickname) {
    return jsonErrorWithRequestId(
      "INVALID_NICKNAME",
      "nickname is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let sanitizedNickname = "";
  try {
    sanitizedNickname = validateStudentText(rawNickname, {
      maxLength: NICKNAME_LIMIT,
      minLength: 1,
      maxLines: 1,
    }).text;
  } catch (error) {
    const status = error instanceof ValidationError ? error.status : 400;
    return jsonErrorWithRequestId(
      "INVALID_NICKNAME",
      "invalid_nickname",
      requestId,
      status,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const subject = await getRateLimitSubject(request, null);
  let rateLimitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    rateLimitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:join-session:nickname:${subject}`,
        windowSeconds: 60,
        limit: 30,
      },
    );
  } catch {
    rateLimitResult = null;
  }

  if (rateLimitResult && !rateLimitResult.ok) {
    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: rateLimitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } }),
    );
  }

  const updated = await updateEduJoinSessionNickname(token, sanitizedNickname);

  if (!updated) {
    return jsonErrorWithRequestId(
      "NOT_FOUND",
      "join_session_not_found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  return jsonOkWithRequestId({ ok: true }, requestId, withNoStoreHeaders());
}
