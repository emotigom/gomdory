import "server-only";

import { readSupabasePublicAnonKey } from "@/lib/env/appConfig";
import {
  REQUIRED_FOR_SMOKE_PROD,
  REQUIRED_POST_DEPLOY_KEYS,
  REQUIRED_SECRETS_PROD,
  REQUIRED_SMOKE_AUTH_KEYS,
  REQUIRED_WEBLLM_KEYS,
} from "@/lib/env/envInventory";
import {
  buildMissingEnvKeys,
  getRuntimeEnv,
  hasEnvString,
  readEnvString,
  type RuntimeEnv,
} from "@/lib/server/runtimeEnv";

export type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch: typeof fetch };
};

export type RuntimeEnvWithBindings = RuntimeEnv & {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  E2E_TURNSTILE_SECRET_KEY?: string;
  IMAGES?: unknown;
  ASSETS?: unknown;
  REALTIME_ROOM?: DurableObjectNamespaceLike;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

export type WebllmEnvState = {
  exists: boolean;
  nonEmpty: boolean;
  sourceHint: "cloudflareEnv" | "processEnv" | "missing";
};

const TURNSTILE_KEYS = ["TURNSTILE_SECRET_KEY", "E2E_TURNSTILE_SECRET_KEY"] as const;
const GLOBAL_NETSAVER_DEFAULT_MODE = "leaseOnly" as const;

export function getSystemDiagEnvChecks(env: RuntimeEnvWithBindings) {
  const hasTurnstileSecretKey = hasEnvString("TURNSTILE_SECRET_KEY");
  const hasE2ETurnstileSecretKey = hasEnvString("E2E_TURNSTILE_SECRET_KEY");

  return {
    hasSupabaseUrl: Boolean(readEnvString("NEXT_PUBLIC_SUPABASE_URL") ?? readEnvString("SUPABASE_URL")),
    hasSupabaseAnonKey: Boolean(readSupabasePublicAnonKey()),
    hasSupabaseServiceRoleKey: hasEnvString("SUPABASE_SERVICE_ROLE_KEY"),
    hasR2AccessKeyId: hasEnvString("R2_ACCESS_KEY_ID"),
    hasR2SecretAccessKey: hasEnvString("R2_SECRET_ACCESS_KEY"),
    hasR2Bucket: hasEnvString("R2_BUCKET"),
    hasTurnstileSecretKey,
    hasE2ETurnstileSecretKey,
    turnstileBypassConfigured: hasTurnstileSecretKey || hasE2ETurnstileSecretKey,
    hasImagesBinding: Boolean(env.IMAGES),
    hasAssetsBinding: Boolean(env.ASSETS),
    hasRealtimeRoomBinding: Boolean(env.REALTIME_ROOM),
  };
}

export function buildWebllmEnvState(key: string): WebllmEnvState {
  const cloudflareEnv =
    (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__ ?? null;
  const hasCloudflareObject = Boolean(cloudflareEnv && typeof cloudflareEnv === "object");
  const cloudflareRecord = hasCloudflareObject ? (cloudflareEnv as Record<string, unknown>) : null;
  const hasCloudflareKey = Boolean(
    cloudflareRecord && Object.prototype.hasOwnProperty.call(cloudflareRecord, key),
  );

  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const hasProcessKey = Boolean(processEnv && Object.prototype.hasOwnProperty.call(processEnv, key));

  const sourceHint: WebllmEnvState["sourceHint"] = hasCloudflareKey
    ? "cloudflareEnv"
    : hasProcessKey
      ? "processEnv"
      : "missing";

  const rawValue = hasCloudflareKey
    ? cloudflareRecord?.[key]
    : hasProcessKey
      ? processEnv?.[key]
      : undefined;
  const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : "";

  return {
    exists: hasCloudflareKey || hasProcessKey,
    nonEmpty: normalizedValue.length > 0,
    sourceHint,
  };
}

export function buildWebllmEnvStatus(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, buildWebllmEnvState(key)]));
}

export function readGlobalNetsaverDefaultMode():
  | "off"
  | "leaseOnly"
  | "auto"
  | "forceP2p"
  | "p2p" {
  const value = readEnvString("NEXT_PUBLIC_EDU_NETSAVER_MODE")?.trim().toLowerCase();
  if (value === "off") return "off";
  if (value === "auto") return "auto";
  if (value === "forcep2p" || value === "force_p2p") return "forceP2p";
  if (value === "p2p") return "p2p";
  return GLOBAL_NETSAVER_DEFAULT_MODE;
}

export function buildSystemDiagEnvSnapshot(runtimeEnv: RuntimeEnvWithBindings = getRuntimeEnv()) {
  const missingForSmoke = buildMissingEnvKeys(REQUIRED_FOR_SMOKE_PROD, {
    allowAnyGroups: [TURNSTILE_KEYS],
    source: runtimeEnv,
  });
  const missingForProd = buildMissingEnvKeys(REQUIRED_SECRETS_PROD, { source: runtimeEnv });
  const missingWebllmKeys = buildMissingEnvKeys(REQUIRED_WEBLLM_KEYS, { source: runtimeEnv });
  const webllmEnv = buildWebllmEnvStatus(REQUIRED_WEBLLM_KEYS);
  const emptyWebllmKeys = Object.entries(webllmEnv)
    .filter(([, status]) => !status.nonEmpty)
    .map(([key]) => key);

  return {
    requiredForSmoke: REQUIRED_FOR_SMOKE_PROD,
    requiredForProd: REQUIRED_SECRETS_PROD,
    requiredSmokeAuthKeys: REQUIRED_SMOKE_AUTH_KEYS,
    requiredPostDeployKeys: REQUIRED_POST_DEPLOY_KEYS,
    requiredWebllmKeys: REQUIRED_WEBLLM_KEYS,
    missingForSmoke,
    missingForProd,
    missingWebllmKeys,
    emptyWebllmKeys,
    webllmEnv,
  };
}
