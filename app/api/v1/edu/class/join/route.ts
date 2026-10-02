import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { readTurnstileFailOpen, readTurnstileSecretKey } from "@/lib/env/appConfig";
import { toCamelKeys, toSnakeKeys } from "@/lib/standards/fields";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";
import { emitEduClassJoinSaveFailure } from "@/lib/edu/classJoinFailure";

const COOKIE_NAME = "edu_anon_id";
const BOARD_COOKIE_NAME = "edu_board_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const TURNSTILE_FAIL_OPEN = readTurnstileFailOpen();
const TURNSTILE_SECRET = readTurnstileSecretKey();

const SHOULD_VERIFY_TURNSTILE = Boolean(TURNSTILE_SECRET || TURNSTILE_FAIL_OPEN);

type JoinBody = {
  shareCode?: string;
  name?: string;
  turnstileToken?: string;
};

type EduClassRow = Database["public"]["Tables"]["edu_classes"]["Row"] & Record<string, unknown>;

function createAnonId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as JoinBody | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const shareCode = normalizeShareCode(payload.shareCode ?? "");
  if (!isLikelyShareCode(shareCode)) {
    return jsonErrorWithRequestId(
      "INVALID_SHARE_CODE",
      "shareCode is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return jsonErrorWithRequestId("INVALID_NAME", "name is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const cookieStore = await cookies();
  const existingAnonId = cookieStore.get(COOKIE_NAME)?.value?.trim();
  const anonId = existingAnonId || createAnonId();

  const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken.trim() : "";

  const subject = await getRateLimitSubject(request, existingAnonId ?? null);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `edu:join:${shareCode || "na"}:${subject}`,
        windowSeconds: 60,
        limit: 20,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "warn",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          stage: "edu_rate_limited",
          action: "join",
          shareCode,
          retryAfterSeconds: limitResult.retryAfterSeconds,
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  if (turnstileToken && SHOULD_VERIFY_TURNSTILE) {
    const ip = request.headers.get("cf-connecting-ip") ?? undefined;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const userAgent = request.headers.get("user-agent");
    const cfRay = request.headers.get("cf-ray");
    const verification = await verifyTurnstileTokenWithTelemetry(turnstileToken, {
      requestId,
      route: request.nextUrl.pathname,
      action: "edu_class_join",
      originHost: origin,
      refererHost: referer,
      ip,
      userAgent,
      shareCode,
      cfRay,
      cookiePresent: Boolean(request.headers.get("cookie")),
    });

    if (!verification.ok) {
      void recordOpsEvent(
        toSnakeKeys({
          level: "warn",
          kind: "api_error",
          requestId,
          route: request.nextUrl.pathname,
          status: 400,
          meta: {
            stage: "edu_join",
            action: "turnstile_failed",
            shareCode,
            result: "failed",
          },
        }) as Parameters<typeof recordOpsEvent>[0],
        { sampleRate: 1, hardLimitPerMinute: 120 },
      );

      return jsonErrorWithRequestId(
        "TURNSTILE_FAILED",
        verification.userMessage,
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }
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
  const { data: joinCodeRow, error: joinCodeError } = joinCodeSelect;

  if (joinCodeError) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 500,
        meta: {
          stage: "edu_join",
          action: "join_code_lookup_failed",
          shareCode,
          message: joinCodeError.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "JOIN_CODE_LOOKUP_FAILED",
      joinCodeError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!joinCodeRow?.board_id) {
    return jsonErrorWithRequestId(
      "CLASS_NOT_FOUND",
      "shareCode not found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const classSelect = (await supabase
    .from("edu_classes")
    .select("locked_at, board_id")
    .eq("board_id", joinCodeRow.board_id)
    .maybeSingle()) as { data: EduClassRow | null; error: { message: string } | null };
  const { data, error: classError } = classSelect;

  const classRecord = data
    ? (toCamelKeys(data) as { lockedAt?: string | null; boardId?: string | null })
    : null;

  if (classError) {
    return jsonErrorWithRequestId(
      "CLASS_LOOKUP_FAILED",
      classError.message,
      requestId,
      500,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!classRecord?.boardId) {
    return jsonErrorWithRequestId(
      "CLASS_NOT_FOUND",
      "shareCode not found",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (classRecord.lockedAt) {
    return jsonErrorWithRequestId(
      "CLASS_LOCKED",
      "수업이 잠겨있어요",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const now = new Date().toISOString();
  const participantRow = toSnakeKeys({
    shareCode,
    anonId,
    name,
    lastSeenAt: now,
    updatedAt: now,
    boardId: classRecord.boardId ?? joinCodeRow.board_id ?? null,
  }) as Database["public"]["Tables"]["edu_participants"]["Insert"];

  const { error: upsertError } = await supabase
    .from("edu_participants")
    .upsert(participantRow, { onConflict: "share_code,anon_id" });

  if (upsertError) {
    return emitEduClassJoinSaveFailure({ requestId, route: request.nextUrl.pathname });
  }

  void recordOpsEvent(
    toSnakeKeys({
      level: "info",
      kind: "api_access",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_join",
        shareCode,
        result: "success",
      },
    }) as Parameters<typeof recordOpsEvent>[0],
    { sampleRate: 10, hardLimitPerMinute: 120 },
  );

  const headers = new Headers(withNoStoreHeaders().headers);
  headers.set("x-request-id", requestId);
  headers.set("x-gom-request-id", requestId);

  const response = NextResponse.json(
    { ok: true, requestId, anonId, name, shareCode, boardId: classRecord.boardId ?? null },
    { headers },
  );

  if (!existingAnonId || existingAnonId !== anonId) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: anonId,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
  }

  if (classRecord.boardId) {
    response.cookies.set({
      name: BOARD_COOKIE_NAME,
      value: classRecord.boardId,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
  }

  return response;
}
