import { NextResponse } from "next/server";

import { flagsFromRow } from "@/lib/edu/featureFlags";
import { resolveWebllmDownloadPolicyFromRequest } from "@/lib/edu/llm/webllmAccessPolicy";
import { readWebllmGlobalEnabled } from "@/lib/env/appConfig";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEduJoinSession } from "@/lib/edu/joinSession";
import { resolveJoinTokenFromRequest } from "@/lib/edu/joinTokenRequest";
import { buildJoinTokenSessionFeatureFlags } from "@/lib/edu/joinTokenSessionFeatureFlags";

const CACHE_SECONDS = 60;
const AUTH_ERROR_KIND = ["auth", "error"].join("_");

const withCacheHeaders = (response: NextResponse, etag: string) => {
  response.headers.set("Cache-Control", `private, max-age=${CACHE_SECONDS}, must-revalidate`);
  response.headers.set("Vary", "Cookie, Authorization");
  response.headers.set("ETag", etag);
  return response;
};

const weakEtag = (value: string) => `W/\"${Buffer.from(value).toString("base64url")}\"`;

export async function GET(request: Request) {
  const globalEnabled = readWebllmGlobalEnabled();
  const downloadPolicy = resolveWebllmDownloadPolicyFromRequest(request);
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const joinToken = resolveJoinTokenFromRequest(request);
    const joinSession = joinToken ? await getEduJoinSession(joinToken) : null;
    if (!joinSession?.shareCode) {
      return NextResponse.json({ error: "unauthorized", errorKind: AUTH_ERROR_KIND }, { status: 401 });
    }

    const body = buildJoinTokenSessionFeatureFlags({
      globalEnabled,
      downloadAllowed: downloadPolicy.downloadAllowed,
    });

    const etag = weakEtag(JSON.stringify({ id: `jt:${joinSession.shareCode}`, body }));
    if (request.headers.get("if-none-match") === etag) {
      return withCacheHeaders(new NextResponse(null, { status: 304 }), etag);
    }
    return withCacheHeaders(NextResponse.json(body), etag);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("edu_feature_flags")
    .select("user_id, webllm_enabled, netsaver_enabled, netsaver_mode, netsaver_p2p_tier, max_bytes")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "feature_flags_query_failed" }, { status: 500 });
  }

  const userFlagsRow = (data as Parameters<typeof flagsFromRow>[0]) ?? null;
  const payload = flagsFromRow(userFlagsRow);

  const reasons: string[] = [];
  if (!globalEnabled) reasons.push("global_disabled");
  if (!downloadPolicy.downloadAllowed) reasons.push("sample_lesson_init_blocked");

  const webllmFeatureEnabled = globalEnabled;
  const webllmDownloadAllowed = downloadPolicy.downloadAllowed;
  const webllmEnabled = webllmFeatureEnabled && payload.webllmEnabled !== false;
  if (!webllmEnabled && payload.webllmEnabled === false) {
    reasons.push("user_disabled");
  } else if (!userFlagsRow) {
    reasons.push("default_webllm_enabled");
  }
  if (reasons.length === 0) reasons.push("enabled");
  const netsaverEnabled = payload.netsaverEnabled === true;

  const body = {
    userFlagsPresent: Boolean(userFlagsRow),
    webllmFeatureEnabled,
    webllmDownloadAllowed,
    webllmEnabled,
    netsaverEnabled,
    netsaverMode: payload.netsaverMode,
    netsaverP2pTier: payload.netsaverP2pTier,
    maxBytes: payload.maxBytes,
    reason: reasons[0] ?? (globalEnabled ? payload.reason : "global_disabled"),
    reasons,
    gatingMode: "user_only" as const,
    allowlistDecision: "not_applicable" as const,
  };

  const etag = weakEtag(JSON.stringify({ id: user.id, body }));
  if (request.headers.get("if-none-match") === etag) {
    return withCacheHeaders(new NextResponse(null, { status: 304 }), etag);
  }

  return withCacheHeaders(NextResponse.json(body), etag);
}
