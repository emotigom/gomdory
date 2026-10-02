import { NextResponse, type NextRequest } from "next/server";

import { jsonOperationalError, jsonOperationalOk } from "@/lib/api/server/operational";
import { logE2ESmokeSecretStatus, readE2ESmokeSecretStatus } from "@/lib/e2e/smokeAuth";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { setBypassCookieOnResponse } from "@/lib/auth/turnstileBypass";

type E2ELoginPayload = {
  email?: string;
  password?: string;
};

function toNextResponse(response: Response): NextResponse {
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function parsePayload(req: NextRequest): Promise<E2ELoginPayload | null> {
  try {
    const payload = (await req.json()) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    return payload as E2ELoginPayload;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          stage: "e2e_login_parse_failed",
          message: error instanceof Error ? error.message : String(error),
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
    return null;
  }
}

async function handlePost(req: NextRequest, _context: unknown, requestContext: RequestContext) {
  const secretStatus = readE2ESmokeSecretStatus(req);
  logE2ESmokeSecretStatus(secretStatus);

  if (!secretStatus.secretMatches) {
    return jsonOperationalError(
      "e2e_secret_mismatch",
      "Missing or mismatched E2E smoke secret. Verify Cloudflare Runtime Secret E2E_SMOKE_SECRET for the deployed Worker.",
      requestContext.requestId,
      401,
    );
  }

  const { supabase, applyCookies, envError } = createSupabaseRouteClient(req);

  if (envError) {
    return applyCookies(toNextResponse(jsonOperationalError("misconfigured_env", envError.message, requestContext.requestId, 500)));
  }

  const payload = await parsePayload(req);
  const email = typeof payload?.email === "string" ? payload.email : null;
  const password = typeof payload?.password === "string" ? payload.password : null;

  if (!email || !password) {
    return applyCookies(toNextResponse(jsonOperationalError("invalid_payload", undefined, requestContext.requestId, 400)));
  }

  const { data, error } = await supabase!.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          stage: "e2e_login_failed",
          message: error?.message,
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );

    return applyCookies(toNextResponse(jsonOperationalError("login_failed", undefined, requestContext.requestId, 401)));
  }

  const response = applyCookies(
    toNextResponse(
      jsonOperationalOk(
        {
          userId: data.user?.id ?? null,
        },
        requestContext.requestId,
      ),
    ),
  );

  const bypassResult = await setBypassCookieOnResponse(response);
  if (!bypassResult.ok) {
    console.log(
      JSON.stringify(
        {
          level: "info",
          stage: "e2e_login_bypass_cookie_skipped",
          reason: bypassResult.reason ?? "unknown",
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  }

  return response;
}

export const POST = withRequestContext(handlePost);
