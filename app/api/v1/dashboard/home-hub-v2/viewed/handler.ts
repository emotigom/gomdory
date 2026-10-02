import { NextResponse } from "next/server";

import { getRequestContext, logAudit } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_LIMIT = 10;

export type HomeHubV2ViewedRouteDeps = {
  action?: string;
  meta?: { source: "dashboard" };
  checkRateLimitFn?: typeof checkRateLimit;
  getRateLimitSubjectFn?: typeof getRateLimitSubject;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  getRequestContextFn?: typeof getRequestContext;
  logAuditFn?: typeof logAudit;
};

function jsonRateLimited(retryAfterSeconds: number, requestId: string | null) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      },
      request_id: requestId,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function handleHomeHubV2ViewedPost(request: Request, deps?: HomeHubV2ViewedRouteDeps) {
  const requestContext = (deps?.getRequestContextFn ?? getRequestContext)(request);

  const getSubject = deps?.getRateLimitSubjectFn ?? getRateLimitSubject;
  const rateLimit = deps?.checkRateLimitFn ?? checkRateLimit;
  const createAdmin = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const auditLogger = deps?.logAuditFn ?? logAudit;

  try {
    const subject = await getSubject(request);
    const key = `dashboard:home_hub_v2:viewed:${subject}`;
    const limitResult = await rateLimit(createAdmin() as unknown as Parameters<typeof checkRateLimit>[0], {
      key,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      limit: RATE_LIMIT_LIMIT,
    });

    if (!limitResult.ok) {
      return jsonRateLimited(limitResult.retryAfterSeconds, requestContext.requestId);
    }
  } catch {
    // fail-open: telemetry/audit signal should not fail closed on rate-limit infra errors
  }

  try {
    void auditLogger({
      action: deps?.action ?? AUDIT_ACTIONS.dashboardHomeHubV2Viewed,
      meta: deps?.meta ?? { source: "dashboard" },
      ctx: requestContext,
    });
  } catch {
    // fail-open: audit logging must not surface as a 500 for this non-critical signal
  }

  return NextResponse.json({ ok: true, request_id: requestContext.requestId }, { status: 200 });
}
