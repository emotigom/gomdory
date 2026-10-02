import { NextResponse } from "next/server";

import { toCamelKeys } from "@/lib/standards/fields";
import { createEduJoinSession } from "@/lib/edu/joinSession";
import { getBoardByShareCode } from "@/lib/data/share";
import { normalizeViewerName } from "@/lib/share/normalizeViewerName";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getHostFromHeaders } from "@/lib/routing/host";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/ops/logEvent";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";
import { readTurnstileSecretKey } from "@/lib/env/appConfig";
import {
  isQ2B4StudentEntryFixtureEnabled,
  Q2_B4_FIXTURE_AUTHORIZATION_HEADER,
  resolveQ2B4StudentEntryFixture,
} from "@/lib/q2/browser/studentEntryFixture";

const STUDENT_NAME_COOKIE = "gomdori_student_name";
const STUDENT_NAME_MAX_AGE = 60 * 60 * 24 * 30;
const SHARE_GATE_COOKIE = "share_gate";
const SHARE_GATE_MAX_AGE = 60 * 10;

function extractHost(value: string | null) {
  if (!value) return undefined;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).host || undefined;
    }
  } catch {
    return undefined;
  }
  return value;
}

function withDebugHeader(
  response: NextResponse,
  host: string,
  requestId: string,
  code?: string,
  turnstileSkipped?: boolean,
) {
  response.headers.set("x-gomdori-join-enter", "1");
  response.headers.set("x-gomdori-join-from-host", host);
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-gom-request-id", requestId);
  if (code) {
    response.headers.set("x-gomdori-join-code", code);
  }
  if (turnstileSkipped) {
    response.headers.set("x-gomdori-turnstile-skip", "1");
  }
  return response;
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request.headers);
  const form = await request.formData();
  const host = getHostFromHeaders(request.headers);
  const rawCode = String(form.get("code") ?? "");
  const rawName = String(form.get("name") ?? "");
  const turnstileToken = String(form.get("turnstileToken") ?? "");
  const code = normalizeShareCode(rawCode);
  const name = normalizeViewerName(rawName);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const turnstileSecret = readTurnstileSecretKey();
  const gateCookieHeader = request.headers.get("cookie") ?? "";
  const gatePresent = /(?:^|;\s*)share_gate=/.test(gateCookieHeader);
  const baseTurnstileSkipped = !turnstileSecret || gatePresent;
  const fixtureAuthorized = isQ2B4StudentEntryFixtureEnabled(
    request.headers.get(Q2_B4_FIXTURE_AUTHORIZATION_HEADER),
  );
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const userAgent = request.headers.get("user-agent");
  const cfRay = request.headers.get("cf-ray");

  const originHost = extractHost(origin);
  const refererHost = extractHost(referer);

  logEvent({
    level: "info",
    stage: "share_join_start",
    requestId,
    route: "/s/enter",
    action: "share_join",
    ok: true,
    meta: {
      originHost,
      refererHost,
      cookiePresent: Boolean(request.headers.get("cookie")),
    },
  });

  if (!code) {
    return withDebugHeader(
      NextResponse.redirect(new URL("/s?error=missing_code", request.url), 303),
      host,
      requestId,
      undefined,
      baseTurnstileSkipped,
    );
  }

  if (!isLikelyShareCode(code)) {
    return withDebugHeader(
      NextResponse.redirect(new URL(`/s?code=${encodeURIComponent(code)}&error=invalid_code`, request.url), 303),
      host,
      requestId,
      code,
      baseTurnstileSkipped,
    );
  }

  const fixtureResolution = resolveQ2B4StudentEntryFixture({
    authorized: fixtureAuthorized,
    code,
  });
  const turnstileSkipped = fixtureResolution.mode !== "inactive" || !turnstileSecret || gatePresent;

  if (fixtureResolution.mode === "active-invalid") {
    return withDebugHeader(
      NextResponse.redirect(new URL(`/s?code=${encodeURIComponent(code)}&error=invalid_code`, request.url), 303),
      host,
      requestId,
      code,
      turnstileSkipped,
    );
  }

  const fixture = fixtureResolution.mode === "active-valid" ? fixtureResolution.fixture : null;

  if (turnstileSecret && !gatePresent && !fixture) {
    const verification = await verifyTurnstileTokenWithTelemetry(turnstileToken, {
      requestId,
      route: "/s/enter",
      action: "share_join",
      originHost,
      refererHost,
      ip,
      userAgent,
      shareCode: code,
      cfRay,
      cookiePresent: Boolean(request.headers.get("cookie")),
    });
    if (!verification.ok) {
      const redirectUrl = new URL("/s?error=turnstile_failed", request.url);
      redirectUrl.searchParams.set("requestId", verification.requestId);
      redirectUrl.searchParams.set("retryable", verification.retryable ? "1" : "0");
      redirectUrl.searchParams.set("hint", verification.hint);
      return withDebugHeader(
        NextResponse.redirect(redirectUrl, 303),
        host,
        requestId,
        code,
      );
    }
  }

  let board = fixture?.board ?? null;
  try {
    if (!fixture) board = await getBoardByShareCode(code);
  } catch {
    logEvent({
      level: "warn",
      stage: "share_present_check",
      requestId,
      route: "/s/enter",
      action: "share_join",
      ok: false,
      code: "BOARD_NOT_FOUND",
    });
    return withDebugHeader(
      NextResponse.redirect(new URL(`/s?code=${encodeURIComponent(code)}&error=invalid_code`, request.url), 303),
      host,
      requestId,
      code,
      turnstileSkipped,
    );
  }
  if (board) {
    logEvent({
      level: "info",
      stage: "share_present_check",
      requestId,
      route: "/s/enter",
      action: "share_join",
      ok: true,
    });
    const redirectUrl = new URL(`/s/${code}`, request.url);
    const response = NextResponse.redirect(redirectUrl, 303);

    if (name) {
      response.cookies.set({
        name: STUDENT_NAME_COOKIE,
        value: name,
        path: "/",
        sameSite: "lax",
        secure: true,
        maxAge: STUDENT_NAME_MAX_AGE,
        domain: ".gkrry.com",
      });
    }
    response.cookies.set({
      name: SHARE_GATE_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: SHARE_GATE_MAX_AGE,
      domain: ".gkrry.com",
    });

    logEvent({
      level: "info",
      stage: "share_join_redirect",
      requestId,
      route: "/s/enter",
      action: "share_join",
      ok: true,
      meta: { target: "/s/:code" },
    });
    return withDebugHeader(response, host, requestId, code, turnstileSkipped);
  }

  const supabase = createSupabaseAdminClient();
  const joinCodeSelect = (await supabase
    .from("edu_join_codes")
    .select("code, board_id, is_active, revoked_at")
    .eq("code", code)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle()) as {
    data: { code?: string | null; board_id?: string | null } | null;
    error: { message: string } | null;
  };
  const { data: joinCodeRow, error: joinCodeError } = joinCodeSelect;

  if (joinCodeError || !joinCodeRow?.board_id) {
    logEvent({
      level: "warn",
      stage: "share_present_check",
      requestId,
      route: "/s/enter",
      action: "share_join",
      ok: false,
      code: "JOIN_CODE_INVALID",
    });
    return withDebugHeader(
      NextResponse.redirect(new URL(`/s?code=${encodeURIComponent(code)}&error=invalid_code`, request.url), 303),
      host,
      requestId,
      code,
      turnstileSkipped,
    );
  }

  const classSelect = (await supabase
    .from("edu_classes")
    .select("locked_at")
    .eq("board_id", joinCodeRow.board_id)
    .maybeSingle()) as {
    data: { locked_at?: string | null } | null;
    error: { message: string } | null;
  };
  const { data: classRow, error: classError } = classSelect;
  const classRecord = classRow ? (toCamelKeys(classRow) as { lockedAt?: string | null }) : null;

  if (classError || !classRow) {
    logEvent({
      level: "warn",
      stage: "share_present_check",
      requestId,
      route: "/s/enter",
      action: "share_join",
      ok: false,
      code: "CLASS_NOT_FOUND",
    });
    return withDebugHeader(
      NextResponse.redirect(new URL(`/s?code=${encodeURIComponent(code)}&error=invalid_code`, request.url), 303),
      host,
      requestId,
      code,
      turnstileSkipped,
    );
  }

  if (classRecord?.lockedAt) {
    logEvent({
      level: "warn",
      stage: "share_present_check",
      requestId,
      route: "/s/enter",
      action: "share_join",
      ok: false,
      code: "CLASS_LOCKED",
    });
    return withDebugHeader(
      NextResponse.redirect(new URL("/s?error=class_locked", request.url), 303),
      host,
      requestId,
      code,
      turnstileSkipped,
    );
  }

  const joinToken = await createEduJoinSession({
    shareCode: code,
    nickname: name || null,
    boardId: joinCodeRow.board_id ?? null,
  });
  const redirectUrl = new URL(`/s/${code}`, request.url);
  if (joinToken) {
    redirectUrl.searchParams.set("jt", joinToken);
  }
  const response = NextResponse.redirect(redirectUrl, 303);

  if (name) {
    response.cookies.set({
      name: STUDENT_NAME_COOKIE,
      value: name,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: STUDENT_NAME_MAX_AGE,
      domain: ".gkrry.com",
    });
  }
  response.cookies.set({
    name: SHARE_GATE_COOKIE,
    value: "1",
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: SHARE_GATE_MAX_AGE,
    domain: ".gkrry.com",
  });

  logEvent({
    level: "info",
    stage: "share_join_redirect",
    requestId,
    route: "/s/enter",
    action: "share_join",
    ok: true,
    meta: { target: "/s/:code", hasJoinToken: Boolean(joinToken) },
  });
  return withDebugHeader(response, host, requestId, code, turnstileSkipped);
}
