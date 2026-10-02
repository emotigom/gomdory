import { NextResponse, type NextRequest } from "next/server";

import { withOps } from "@/lib/ops/withOps";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { maskPii } from "@/lib/safety/piiMask";
import { validateSupabaseEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LogPayload = {
  level?: unknown;
  route?: unknown;
  requestId?: unknown;
  message?: unknown;
  stack?: unknown;
  meta?: unknown;
};

const MAX_STACK_LENGTH = 2000;

function buildCorsHeaders(request: NextRequest, allow: boolean): Headers {
  const headers = new Headers();
  if (allow) {
    const origin = request.headers.get("origin");
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestHost = new URL(request.url).host.toLowerCase();
    const originHost = new URL(origin).host.toLowerCase();
    return requestHost === originHost;
  } catch {
    return false;
  }
}

type SanitizedPayload = {
  level: "info" | "warn" | "error";
  route: string | null;
  requestId: string | null;
  message: string;
  stack: string | null;
  reasons: string[];
  meta: Record<string, unknown>;
};

function sanitizePayload(body: LogPayload): SanitizedPayload {
  const level: SanitizedPayload["level"] = body.level === "warn" || body.level === "error" ? body.level : "info";
  const route = typeof body.route === "string" ? body.route.slice(0, 200) : null;
  const requestId = typeof body.requestId === "string" ? body.requestId.slice(0, 120) : null;
  const rawMessage = typeof body.message === "string" ? body.message.slice(0, 500) : "client_log";
  const rawStack = typeof body.stack === "string" ? body.stack.slice(0, MAX_STACK_LENGTH) : null;
  const sanitizedMessage = maskPii(rawMessage);
  const sanitizedStack = rawStack ? maskPii(rawStack) : { text: null, reasons: [] };

  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : {};

  return {
    level,
    route,
    requestId,
    message: sanitizedMessage.text,
    stack: sanitizedStack.text,
    reasons: Array.from(new Set([...sanitizedMessage.reasons, ...sanitizedStack.reasons])),
    meta,
  };
}

async function storeLog(entry: {
  level: "info" | "warn" | "error";
  route: string | null;
  requestId: string | null;
  message: string;
  stack: string | null;
  reasons: string[];
  meta: Record<string, unknown>;
}) {
  const env = validateSupabaseEnv({ requireServiceRoleKey: true });
  if (!env.ok) return false;

  const client = createSupabaseAdminClient();
  const table = "ops_logs" as const;
  const opsLogs = client.from(table) as unknown as {
    insert(values: unknown): PromiseLike<{ error: { message: string } | null }>;
  };
  const { error } = await opsLogs.insert({
    level: entry.level,
    route: entry.route,
    request_id: entry.requestId,
    message: entry.message,
    meta: {
      stack: entry.stack,
      reasons: entry.reasons,
      ...entry.meta,
    },
  });

  return !error;
}

export const OPTIONS = (request: NextRequest) => {
  const headers = buildCorsHeaders(request, isSameOrigin(request));
  return new NextResponse(null, { status: 204, headers });
};

export const POST = withOps(async (request: NextRequest) => {
  const allowOrigin = isSameOrigin(request);
  const corsHeaders = buildCorsHeaders(request, allowOrigin);
  if (!allowOrigin) {
    return new NextResponse(JSON.stringify({ ok: false, code: "forbidden" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const body = (await request.json().catch(() => null)) as LogPayload | null;
  if (!body) {
    return new NextResponse(JSON.stringify({ ok: false, code: "invalid_payload" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const sanitized = sanitizePayload(body);
  const saved = await storeLog({
    level: sanitized.level,
    route: sanitized.route,
    requestId: sanitized.requestId,
    message: sanitized.message,
    stack: sanitized.stack,
    reasons: sanitized.reasons,
    meta: sanitized.meta,
  });

  if (!saved) {
    console.warn("[ops/log] fallback console log", {
      level: sanitized.level,
      route: sanitized.route,
      message: sanitized.message,
      requestId: sanitized.requestId,
    });
  }

  const response = NextResponse.json(
    {
      ok: true,
      requestId: sanitized.requestId ?? request.headers.get("x-request-id") ?? null,
      reasons: sanitized.reasons,
    },
    { headers: corsHeaders },
  );
  return response;
}, { log: false, errorCode: "unknown" });
