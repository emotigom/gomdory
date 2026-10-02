import "server-only";

import { AwsClient } from "aws4fetch";

import { flagsFromRow, type EduFeatureFlagsRow } from "@/lib/edu/featureFlags";
import { resolveWebllmDownloadPolicyFromRequest } from "@/lib/edu/llm/webllmAccessPolicy";
import { resolveWebllmConfig } from "@/lib/edu/llm/webllmResolvedConfig";
import {
  getEduWebLLMEnableFlag,
  getWebLLMLabsFlag,
} from "@/lib/edu/llm/webllmFeatureFlags";
import { summarizePublishLimiterPolicy } from "@/lib/edu/publish/quota";
import { readSupabasePublicAnonKey, readSupabaseCanonicalPublicUrl } from "@/lib/env/appConfig";
import { readRuntimeIdentity } from "@/lib/env/runtimeIdentity";
import { isEmergencyMode, isReadOnlyMode } from "@/lib/flags/emergency";
import { isWebLLMEnabled } from "@/lib/flags/featureFlags";
import { mapDbModeToApiMode, mapDbTierToApiTier } from "@/lib/ops/eduFeatureFlagsStore";
import { getR2TargetMeta } from "@/lib/r2/client";
import { getRuntimeEnv, readEnvString } from "@/lib/server/runtimeEnv";
import { EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildSystemDiagEnvSnapshot,
  getSystemDiagEnvChecks,
  readGlobalNetsaverDefaultMode,
  type RuntimeEnvWithBindings,
} from "@/lib/system/diag/envStatus";
import type { SystemDiagResponse, SystemDiagSuccess } from "@/lib/system/diag/types";

const readGlobalWebLLMEnable = () => getEduWebLLMEnableFlag();
const readGlobalWebLLMLabs = () => getWebLLMLabsFlag();

function getEduPublishR2TargetMeta() {
  try {
    const target = getR2TargetMeta();
    return { configured: true, ...target };
  } catch {
    return { configured: false as const };
  }
}

async function checkR2(env: RuntimeEnvWithBindings): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
}> {
  const record = env as Record<string, unknown>;
  const accountId = record.R2_ACCOUNT_ID;
  const bucket = record.R2_BUCKET;
  const accessKeyId = record.R2_ACCESS_KEY_ID;
  const secretAccessKey = record.R2_SECRET_ACCESS_KEY;

  const configured = Boolean(accountId && bucket && accessKeyId && secretAccessKey);
  if (!configured) {
    return { configured: false, ok: false, latencyMs: null };
  }

  try {
    const client = new AwsClient({
      accessKeyId: String(accessKeyId),
      secretAccessKey: String(secretAccessKey),
      service: "s3",
      region: "auto",
    });

    const endpoint = `https://${String(accountId)}.r2.cloudflarestorage.com`;
    const listUrl = new URL(`${endpoint}/${String(bucket)}`);
    listUrl.searchParams.set("max-keys", "1");

    const started = Date.now();
    const signed = await client.sign(listUrl, { method: "GET" });
    const response = await fetch(signed);
    const latencyMs = Date.now() - started;

    return { configured: true, ok: response.ok, latencyMs };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "diag_r2_check_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { configured: true, ok: false, latencyMs: null };
  }
}

async function checkDurableObject(env: RuntimeEnvWithBindings): Promise<{
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
}> {
  if (!env.REALTIME_ROOM) {
    return { configured: false, ok: false, latencyMs: null };
  }

  try {
    const id = env.REALTIME_ROOM.idFromName("system-diag");
    const stub = env.REALTIME_ROOM.get(id);
    const started = Date.now();
    const response = await stub.fetch("https://internal.gomboard/__diag/ping");
    const latencyMs = Date.now() - started;
    const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return { configured: true, ok: response.ok && payload?.ok === true, latencyMs };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "diag_durable_object_check_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { configured: true, ok: false, latencyMs: null };
  }
}

type SupabaseReachabilityCheck = {
  ok: boolean;
  latencyMs: number | null;
};

async function checkSupabaseReachability(): Promise<SupabaseReachabilityCheck> {
  const supabaseUrl = readSupabaseCanonicalPublicUrl() ?? readEnvString("SUPABASE_URL");
  const supabaseAnonKey = readSupabasePublicAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, latencyMs: null };
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 3500);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
      },
      signal: abortController.signal,
      cache: "no-store",
    });

    const latencyMs = Date.now() - startedAt;
    const reachable = response.status < 500;
    return { ok: reachable, latencyMs };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "diagSupabaseReachabilityFailed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { ok: false, latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAdminTableAccess(table: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from(table).select("*").limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkDecorateReadiness() {
  const hasSupabaseServiceRoleKey = Boolean(readEnvString("SUPABASE_SERVICE_ROLE_KEY"));
  if (!hasSupabaseServiceRoleKey) {
    return {
      hasOpenAiKey: Boolean(readEnvString("OPENAI_API_KEY")),
      hasSupabaseUrl: Boolean(readEnvString("NEXT_PUBLIC_SUPABASE_URL") ?? readEnvString("SUPABASE_URL")),
      hasSupabaseAnonKey: Boolean(readSupabasePublicAnonKey()),
      hasSupabaseServiceRoleKey,
      hasRateLimitTableAccess: false,
      hasDecoratePlanCacheAccess: false,
      hasJoinSessionAccess: false,
    };
  }

  const [hasRateLimitTableAccess, hasDecoratePlanCacheAccess, hasJoinSessionAccess] = await Promise.all([
    checkAdminTableAccess("rate_limits"),
    checkAdminTableAccess("decorate_plan_cache"),
    checkAdminTableAccess(EDU_TABLES.joinSessions),
  ]);

  return {
    hasOpenAiKey: Boolean(readEnvString("OPENAI_API_KEY")),
    hasSupabaseUrl: Boolean(readEnvString("NEXT_PUBLIC_SUPABASE_URL") ?? readEnvString("SUPABASE_URL")),
    hasSupabaseAnonKey: Boolean(readSupabasePublicAnonKey()),
    hasSupabaseServiceRoleKey,
    hasRateLimitTableAccess,
    hasDecoratePlanCacheAccess,
    hasJoinSessionAccess,
  };
}

function buildEffectiveSummary(input: {
  global: {
    webllmEnable: boolean;
    webllmLabs: boolean;
    netsaverDefaultMode: ReturnType<typeof readGlobalNetsaverDefaultMode>;
  };
  downloadAllowed: boolean;
  perUserFlags: ReturnType<typeof flagsFromRow> | undefined;
}) {
  const effectiveReasons: string[] = [];
  const webllmFeatureEnabled = input.global.webllmEnable;
  const webllmDownloadAllowed = input.downloadAllowed;
  const webllm = webllmFeatureEnabled && webllmDownloadAllowed && (input.perUserFlags?.webllmEnabled !== false);
  const netsaver =
    input.global.webllmEnable &&
    input.global.netsaverDefaultMode !== "off" &&
    Boolean(input.perUserFlags?.netsaverEnabled);

  if (!input.global.webllmEnable) {
    effectiveReasons.push("globalWebllmDisabled");
    if (input.global.webllmLabs) {
      effectiveReasons.push("labsOnly");
    }
  }
  if (!webllmDownloadAllowed) effectiveReasons.push("sampleLessonInitBlocked");
  if (input.perUserFlags && input.perUserFlags.webllmEnabled === false) {
    effectiveReasons.push("userWebllmDisabled");
  } else if (!input.perUserFlags) {
    effectiveReasons.push("defaultWebllmEnabled");
  }
  if (input.global.netsaverDefaultMode === "off") effectiveReasons.push("globalNetsaverOff");
  if (input.perUserFlags && !input.perUserFlags.netsaverEnabled) effectiveReasons.push("userNetsaverDisabled");
  if (effectiveReasons.length === 0) effectiveReasons.push("enabled");

  return {
    webllmFeatureEnabled,
    webllmDownloadAllowed,
    webllm,
    netsaver,
    reasons: effectiveReasons,
  };
}

export async function buildSystemDiagResponse(request: Request, requestId: string): Promise<SystemDiagResponse> {
  const runtimeEnv = getRuntimeEnv() as RuntimeEnvWithBindings;
  let supabaseAuthLatencyMs: number | null = null;
  let supabaseReachable = false;
  let hasUser = false;
  let perUserFlags: ReturnType<typeof flagsFromRow> | undefined;

  const global = {
    webllmEnable: readGlobalWebLLMEnable(),
    webllmLabs: readGlobalWebLLMLabs(),
    netsaverDefaultMode: readGlobalNetsaverDefaultMode(),
  };
  const gatingMode = "userOnly" as const;
  const downloadPolicy = resolveWebllmDownloadPolicyFromRequest(request);

  const supabaseReachability = await checkSupabaseReachability();
  supabaseReachable = supabaseReachability.ok;
  supabaseAuthLatencyMs = supabaseReachability.latencyMs;

  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;
    hasUser = Boolean(userId);

    if (userId) {
      const { data: flagsData, error: flagsError } = await supabase
        .from("edu_feature_flags")
        .select("user_id, webllm_enabled, netsaver_enabled, netsaver_mode, netsaver_p2p_tier, max_bytes")
        .eq("user_id", userId)
        .maybeSingle();

      if (flagsError) {
        throw flagsError;
      }

      perUserFlags = flagsFromRow((flagsData as EduFeatureFlagsRow | null) ?? null);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "diag_supabase_check_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  try {
    const [r2, durableObject, decorateReadiness] = await Promise.all([
      checkR2(runtimeEnv),
      checkDurableObject(runtimeEnv),
      checkDecorateReadiness(),
    ]);
    const envSnapshot = buildSystemDiagEnvSnapshot(runtimeEnv);
    const resolvedWebllm = resolveWebllmConfig();
    const { buildId, versionId, envName } = readRuntimeIdentity();
    const effective = buildEffectiveSummary({
      global,
      downloadAllowed: downloadPolicy.downloadAllowed,
      perUserFlags,
    });

    const perUserFlagsDto = perUserFlags
      ? {
          ...perUserFlags,
          netsaverMode: mapDbModeToApiMode(perUserFlags.netsaverMode),
          netsaverP2pTier: mapDbTierToApiTier(perUserFlags.netsaverP2pTier),
        }
      : undefined;

    const responseBody: SystemDiagSuccess = {
      ok: true,
      now: new Date().toISOString(),
      host: request.headers.get("host"),
      envName,
      buildId,
      versionId,
      requestId,
      requiredForSmoke: envSnapshot.requiredForSmoke,
      requiredForProd: envSnapshot.requiredForProd,
      requiredSmokeAuthKeys: envSnapshot.requiredSmokeAuthKeys,
      requiredPostDeployKeys: envSnapshot.requiredPostDeployKeys,
      requiredWebllmKeys: envSnapshot.requiredWebllmKeys,
      missingForSmoke: envSnapshot.missingForSmoke,
      missingForProd: envSnapshot.missingForProd,
      missingWebllmKeys: envSnapshot.missingWebllmKeys,
      emptyWebllmKeys: envSnapshot.emptyWebllmKeys,
      webllmEnv: envSnapshot.webllmEnv,
      webllmResolved: {
        source: resolvedWebllm.envSource,
        hardDisable: resolvedWebllm.hardDisable,
        hardDisableRaw: resolvedWebllm.hardDisableRaw ?? null,
        modelBase: resolvedWebllm.modelBase,
        libBase: resolvedWebllm.libBase,
        coachModelId: resolvedWebllm.coach?.modelId ?? null,
        coachWasmUrl: resolvedWebllm.coach?.paths.wasmUrl ?? null,
      },
      featureFlags: {
        emergencyMode: isEmergencyMode(),
        emergencyReadOnly: isReadOnlyMode(),
        webllmEnabled: isWebLLMEnabled(),
      },
      global: {
        ...global,
        webllmPilotAllowlistCount: 0,
      },
      ...(perUserFlagsDto ? { perUserFlags: perUserFlagsDto } : {}),
      effective: {
        webllmFeatureEnabled: effective.webllmFeatureEnabled,
        webllmDownloadAllowed: effective.webllmDownloadAllowed,
        webllm: effective.webllm,
        netsaver: effective.netsaver,
        netsaverMode: effective.netsaver ? perUserFlagsDto?.netsaverMode ?? "leaseOnly" : "off",
        netsaverTier: perUserFlagsDto?.netsaverP2pTier ?? "meta",
        gatingMode,
        reasons: effective.reasons,
        reason: effective.reasons,
      },
      checks: {
        env: getSystemDiagEnvChecks(runtimeEnv),
        auth: { ok: hasUser },
        supabase: { ok: supabaseReachable, latencyMs: supabaseAuthLatencyMs },
        r2,
        durableObject,
        decorateReadiness,
      },
      eduPublish: {
        r2Target: getEduPublishR2TargetMeta(),
        limiter: {
          ...summarizePublishLimiterPolicy(),
          policySummary: "success-based: count only PUBLISHED commits per KST day",
        },
      },
    };

    return responseBody;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "diag_unexpected_error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { ok: false, code: "server_error", requestId };
  }
}
