import { NextResponse, type NextRequest } from "next/server";

import { withObs } from "@/lib/http/withObs";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { safeStudentText } from "@/lib/safety/safeStudentText";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { digestHex } from "@/lib/crypto/webcrypto";
import { recordAuditEvent } from "@/lib/data/auditEvents";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 10;
const OPS_REQUEST_ID_KEY = ["request", "id"].join("_");
const MESSAGE_META_FALLBACK = ["abort", "meta"].join("_");
const USER_CANCEL_REASON = ["user", "cancel"].join("_");

type UiErrorPayload = {
  kind?: string | null;
  message: string;
  stackHash?: string | null;
  requestId?: string | null;
  route?: string | null;
  userType?: string | null;
  userAgentShort?: string | null;
  url?: string | null;
  ua?: string | null;
  ts?: number | null;
  abortReason?: string | null;
  phase?: string | null;
  elapsedMs?: number | null;
  timeoutMs?: number | null;
  usingLocalWebLLM?: boolean | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
  rawMessage?: string | null;
};

type UiErrorAbortMeta = {
  abortReason?: string | null;
  phase?: string | null;
  startedAt?: number | null;
  elapsedMs?: number | null;
  timeoutMs?: number | null;
  usingLocalWebLLM?: boolean | null;
  modelId?: string | null;
  stage?: string | null;
  retryCount?: number | null;
  slotCandidatesCount?: number | null;
  selectedSlotId?: string | null;
  selectedSelector?: string | null;
  slotResolveSource?: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value: unknown, max = 200) {
  if (typeof value !== "string") return null;
  return value.slice(0, max);
}

function parseJsonMessageMeta(message: string): UiErrorAbortMeta | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as UiErrorAbortMeta | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin ?? "*");
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type, x-smoke-test");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("cache-control", "no-store");
  return headers;
}

function applyCors(response: Response, request: NextRequest) {
  const corsHeaders = buildCorsHeaders(request);
  corsHeaders.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const OPTIONS = (request: NextRequest) =>
  applyCors(NextResponse.json({ ok: true, note: "preflight" }, { status: 200 }), request);

export const GET = (request: NextRequest) =>
  applyCors(NextResponse.json({ ok: true, note: "ok" }, { status: 200 }), request);

function isSmokeProbe(request: NextRequest, body: UiErrorPayload | null) {
  const smokeHeader = request.headers.get("x-smoke-test");
  if (smokeHeader && ["1", "true", "yes", "on"].includes(smokeHeader.toLowerCase())) {
    return true;
  }
  return body?.kind === "smoke_test";
}

export const POST = withObs(async (request: NextRequest, _ctx, trace) => {
  let body: UiErrorPayload | null = null;
  try {
    body = (await request.json()) as UiErrorPayload;
  } catch {
    body = null;
  }

  try {
    const subject = await getRateLimitSubject(request, null);
    const limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `uierr:${request.headers.get("host") ?? "unknown"}:${subject}`,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
        limit: RATE_LIMIT_MAX,
      },
    );

    const smokeProbe = isSmokeProbe(request, body);
    if (smokeProbe) {
      const message = normalizeString(body?.message ?? "smoke_ui_error", 200) ?? "smoke_ui_error";
      const hasBody = Boolean(body);
      void recordOpsEvent({
        level: "info",
        kind: "smoke",
        [OPS_REQUEST_ID_KEY]: trace.requestId,
        route: normalizeString(body?.url ?? body?.route ?? null, 200),
        meta: {
          stage: "ui_error_ingest",
          acceptedAs: "smoke_test",
          hasBody,
          message,
          rateLimited: !limitResult.ok,
        },
      });

      return applyCors(
        NextResponse.json(
          { ok: true, requestId: trace.requestId, received: hasBody, note: "smoke_test" },
          { status: 200 },
        ),
        request,
      );
    }

    if (body && typeof body.message === "string") {
      const parsedMessageMeta = parseJsonMessageMeta(body.message);
      const rawMessage = body.message;
      const messageForSafety = parsedMessageMeta ? MESSAGE_META_FALLBACK : body.message;
      const messageSafe = safeStudentText(messageForSafety, { maxLength: 500 });
      const message = messageSafe.text ?? "";
      const stackHash = normalizeString(body.stackHash, 160);
      const sourceRequestId = normalizeString(body.requestId, 120);
      const route = normalizeString(body.route, 200);
      const userType = normalizeString(body.userType, 50);
      const userAgentShort = normalizeString(body.userAgentShort, 200);
      const abortReason = normalizeString(body.abortReason ?? parsedMessageMeta?.abortReason, 50);
      const phase = normalizeString(body.phase ?? parsedMessageMeta?.phase, 120);
      const elapsedMs =
        typeof body.elapsedMs === "number"
          ? Math.max(0, Math.round(body.elapsedMs))
          : typeof parsedMessageMeta?.elapsedMs === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.elapsedMs))
            : typeof parsedMessageMeta?.startedAt === "number"
              ? Math.max(0, Date.now() - Math.round(parsedMessageMeta.startedAt))
              : null;
      const timeoutMs =
        typeof body.timeoutMs === "number"
          ? Math.max(0, Math.round(body.timeoutMs))
          : typeof parsedMessageMeta?.timeoutMs === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.timeoutMs))
            : null;
      const usingLocalWebLLM =
        typeof body.usingLocalWebLLM === "boolean"
          ? body.usingLocalWebLLM
          : typeof parsedMessageMeta?.usingLocalWebLLM === "boolean"
            ? parsedMessageMeta.usingLocalWebLLM
            : null;
      const modelId = normalizeString(body.modelId ?? parsedMessageMeta?.modelId, 120);
      const decorateStage = normalizeString(body.stage ?? parsedMessageMeta?.stage, 120);
      const retryCount =
        typeof body.retryCount === "number"
          ? Math.max(0, Math.round(body.retryCount))
          : typeof parsedMessageMeta?.retryCount === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.retryCount))
            : null;
      const slotCandidatesCount =
        typeof body.slotCandidatesCount === "number"
          ? Math.max(0, Math.round(body.slotCandidatesCount))
          : typeof parsedMessageMeta?.slotCandidatesCount === "number"
            ? Math.max(0, Math.round(parsedMessageMeta.slotCandidatesCount))
            : null;
      const selectedSlotId = normalizeString(body.selectedSlotId ?? parsedMessageMeta?.selectedSlotId, 120);
      const selectedSelector = normalizeString(body.selectedSelector ?? parsedMessageMeta?.selectedSelector, 240);
      const slotResolveSource = normalizeString(body.slotResolveSource ?? parsedMessageMeta?.slotResolveSource, 40);
      const messageHash = message ? await digestHex("SHA-256", message) : null;

      await recordOpsEvent({
        level: abortReason === USER_CANCEL_REASON ? "info" : "warn",
        kind: body.message === "slow_ui" ? "ui_slow" : "ui_error",
        [OPS_REQUEST_ID_KEY]: trace.requestId,
        route,
        meta: {
          stage: "ui_error_ingest",
          acceptedAs: "normal",
          hasBody: true,
          messageHash,
          stackHash,
          sourceRequestId,
          rawMessage: normalizeString(rawMessage, 500),
          userType: userType ?? "unknown",
          userAgentShort,
          abortReason,
          phase,
          elapsedMs,
          timeoutMs,
          usingLocalWebLLM,
          modelId,
          decorateStage,
          retryCount,
          slotCandidatesCount,
          selectedSlotId,
          selectedSelector,
          slotResolveSource,
          rateLimited: !limitResult.ok,
        },
      });

      void recordAuditEvent({
        actorAnonId: subject,
        action: "ui_error_reported",
        requestId: trace.requestId,
        host: request.headers.get("host"),
        meta: {
          messageHash,
          flags: messageSafe.flags,
          piiHitsCount: messageSafe.piiHits.length,
          sourceRequestId,
          route,
        },
      });
    }
  } catch (error) {
    console.warn("[ops] ui-error handler failed", error);
  }

  return applyCors(
    NextResponse.json(
      { ok: true, requestId: trace.requestId, received: Boolean(body) },
      { status: 200 },
    ),
    request,
  );
}, { errorKind: "ui_error", slowKind: "ui_slow" });
