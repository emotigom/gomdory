import { readEnvString } from "@/lib/server/runtimeEnv";
import { DAILY_PUBLISH_LIMIT } from "@/lib/edu/publish/quota";

export type StudentCoachMode = "disabled" | "guide" | "template" | "backend";

const DEFAULT_EDUVIEW_ORIGIN = "https://eduview.gkrry.com";

// Phase-8 pre-cutover intent anchors (final lock before actual Cloudflare build/runtime migration).
// Documentation and operator planning helpers only; runtime behavior must remain unchanged.
// - remove-ready: keep fallback in helper for now, but treat as first removal candidates once zero-hit validation passes.
// - keep-for-now: alias still required for staged ops rollout or debug/legacy fallback scope.
export const PHASE8_REMOVE_READY_ALIASES = [
  "EDU_LLM_ENDPOINT",
  "EDU_LLM_API_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
] as const;

// Phase-11 first actual cleanup (smallest safe bundle): build id legacy aliases removed.
export const PHASE11_REMOVED_ALIASES = ["NEXT_BUILD_ID", "NEXT_PUBLIC_BUILD_ID"] as const;

// Phase-19 smallest runtime-adjacent actual cleanup: Supabase public legacy aliases removed.
export const PHASE19_REMOVED_RUNTIME_ADJACENT_ALIASES = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
] as const;

export const PHASE8_KEEP_FOR_NOW_ALIASES = [
  "OPENAI_KEY", // debug/legacy direct-openai fallback scope (not mainline).
  "E2E_TURNSTILE_SECRET_KEY", // test/e2e bypass compatibility until ops confirms isolation.
  "LOG_HASH_SALT", // legacy log hashing salt fallback; keep until TURNSTILE_LOG_SALT rollout is complete.
] as const;

// Phase-13 guardrail: legacy proxy aliases remain runtime fallback only (deprecate-only).
// Do not introduce new call-site awareness outside helper boundaries.
export const PHASE13_PROXY_DEPRECATE_ONLY_ALIASES = ["EDU_LLM_ENDPOINT", "EDU_LLM_API_KEY"] as const;

// Phase-14 deprecate-only fallback set lock.
// These aliases can stay only in helper/runtime compatibility boundaries until a dedicated actual cleanup PR.
export const PHASE14_DEPRECATE_ONLY_RUNTIME_FALLBACK_ALIASES = [...PHASE13_PROXY_DEPRECATE_ONLY_ALIASES] as const;

// Phase-14 hardening: alias bucket lock to prevent cross-layer reintroduction before next actual cleanup.
// - removed: actual cleanup complete (fallback deleted).
// - deprecate-only-runtime-fallback: fallback stays in helper, but call-sites/docs/scripts/tests should be narrowed.
// - remove-ready-candidates: non-provider-critical aliases with narrowing complete and small rollback radius.
// - keep-for-now: provider/debug/e2e/ops safety aliases; do not remove in this stage.
export const PHASE14_ALIAS_BUCKETS = {
  removed: [...PHASE11_REMOVED_ALIASES, ...PHASE19_REMOVED_RUNTIME_ADJACENT_ALIASES] as const,
  deprecateOnlyRuntimeFallback: PHASE14_DEPRECATE_ONLY_RUNTIME_FALLBACK_ALIASES,
  removeReadyCandidates: [] as const,
  keepForNow: PHASE8_KEEP_FOR_NOW_ALIASES,
} as const;

// Phase-17 lock refresh (non-runtime cleanup near-final):
// - keep runtime behavior identical while clarifying what is cleaned vs deferred.
// - runtime-adjacent next-candidates remain review-only until operator verification.
export const PHASE17_RUNTIME_ADJACENT_NEXT_CANDIDATES = ["EDU_LLM_ENDPOINT", "EDU_LLM_API_KEY"] as const;

export const PHASE17_NON_RUNTIME_CLEANUP_FOCUS = {
  docsTestsScriptsDiagnosticsReadiness: true,
  providerCriticalFallbackRemoval: false,
  keepForNowAliasRemoval: false,
} as const;

// Phase-18 runtime-adjacent review lock (classification only, no behavior change):
// - actualCleanupReady: smallest next scope candidates, but still requires operator verification before removal PR.
// - deprecateOnly: runtime fallback remains mandatory in this phase.
// - keepForNow: explicit do-not-remove in current architecture boundary.
// - evidencePending: insufficient operator/runtime evidence to promote cleanup.
export const PHASE18_RUNTIME_ALIAS_REVIEW_BUCKETS = {
  actualCleanupReady: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"] as const,
  deprecateOnly: ["EDU_LLM_ENDPOINT", "EDU_LLM_API_KEY"] as const,
  keepForNow: PHASE8_KEEP_FOR_NOW_ALIASES,
  evidencePending: ["EDU_LLM_ENDPOINT", "EDU_LLM_API_KEY"] as const,
} as const;

// Phase-19 execution state: smallest actualCleanupReady bundle only.
export const PHASE19_RUNTIME_ALIAS_STATUS = {
  removed: PHASE19_REMOVED_RUNTIME_ADJACENT_ALIASES,
  deprecateOnly: PHASE13_PROXY_DEPRECATE_ONLY_ALIASES,
  keepForNow: PHASE8_KEEP_FOR_NOW_ALIASES,
  evidencePending: ["EDU_LLM_ENDPOINT", "EDU_LLM_API_KEY"] as const,
} as const;

// Phase-20 post-phase-19 stabilization lock:
// - This phase focuses on reclassification/verification, not mandatory additional removals.
// - Provider-critical or student-mainline-adjacent aliases should stay deprecate-only/keep-for-now
//   unless dedicated operator evidence allows a narrowly scoped removal PR.
export const PHASE20_RUNTIME_ALIAS_BUCKETS = {
  removed: [...PHASE11_REMOVED_ALIASES, ...PHASE19_REMOVED_RUNTIME_ADJACENT_ALIASES] as const,
  deprecateOnlyRuntimeFallback: PHASE13_PROXY_DEPRECATE_ONLY_ALIASES,
  keepForNow: PHASE8_KEEP_FOR_NOW_ALIASES,
  evidencePending: ["EDU_LLM_ENDPOINT", "EDU_LLM_API_KEY"] as const,
  maybeNextCleanup: [] as const,
  stopHereAndRefactorStructure: ["OPENAI_KEY", "E2E_TURNSTILE_SECRET_KEY", "LOG_HASH_SALT"] as const,
} as const;

export const PHASE20_POST_PHASE19_STABILIZATION = {
  reviewOnly: true,
  allowAdditionalActualCleanupByDefault: false,
  preserveStudentMainlineProviderSemantics: true,
  operatorVerificationRequired: [
    "system_diag_smoke",
    "ops_runtime_route_smoke",
    "proxy_auth_rotation_smoke",
    "student_mainline_bootstrap_smoke",
  ] as const,
} as const;

export const PHASE18_RUNTIME_ADJACENT_SCOPE_LOCK = {
  reviewOnly: true,
  allowRuntimeFallbackRemoval: false,
  operatorVerificationRequired: [
    "system_diag_smoke",
    "proxy_auth_rotation_smoke",
    "student_mainline_bootstrap_smoke",
  ] as const,
} as const;


// Phase-12 second actual cleanup anchors (small/public-readiness scope only).
export const PHASE12_SECOND_ACTUAL_CLEANUP_SCOPE = {
  deprecateOnlyRuntimeFallback: PHASE14_DEPRECATE_ONLY_RUNTIME_FALLBACK_ALIASES,
  removeReadyCandidates: [] as const,
  keepForNow: PHASE8_KEEP_FOR_NOW_ALIASES,
} as const;

// Build/runtime lock references used by runbook/docs.
// Build minimal public set should stay in build-time Variables.
export const PHASE8_BUILD_MINIMAL_PUBLIC_LOCKED_SET = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SHORT_SITE_URL",
  "NEXT_PUBLIC_EDUVIEW_ORIGIN",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_EDU_WEBLLM_ENABLE",
  "NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE",
  "NEXT_PUBLIC_EDU_WEBLLM_DEBUG",
] as const;

// Runtime-only final candidates (move/remain in runtime secrets/vars during actual migration).
export const PHASE8_RUNTIME_ONLY_FINAL_CANDIDATES = [
  "EDU_OPENAI_PROXY_URL",
  "EDU_OPENAI_PROXY_TOKEN",
  "EDU_OPENAI_PROXY_CHAT_PATH",
  "EDU_OPENAI_PROXY_DECORATE_PATH",
  "EDU_OPENAI_PROXY_HEALTH_PATH",
  "EDU_OPENAI_PROXY_TIMEOUT_MS",
  "EDU_STUDENT_AI_SAFE_MODE",
  "EDU_STUDENT_COACH_MODE",
  "EDU_DECORATE_FORCE_DETERMINISTIC",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_LOG_SALT",
  "TURNSTILE_FAIL_OPEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "EMERGENCY_MODE",
  "EMERGENCY_READONLY",
  "OPS_ADMIN_EMAILS",
  "BUILD_ID",
] as const;

// Phase-9 actual migration step-1 (smallest build-side cleanup).
// Scope: remove only clearly runtime-only/secret/test-debug keys from build Variables.
// Guardrails: no alias deletion, no canonical rename, no runtime behavior changes.
export const PHASE9_STEP1_BUILD_REMOVAL_CANDIDATES = [
  // backend proxy runtime secrets/config
  "EDU_OPENAI_PROXY_TOKEN",
  "EDU_OPENAI_PROXY_TIMEOUT_MS",
  // turnstile/runtime secret path (site key remains public build key)
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_LOG_SALT",
  "TURNSTILE_FAIL_OPEN",
  // server-only auth/storage secrets
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  // debug/test-only compatibility aliases kept at runtime only
  "OPENAI_KEY",
  "E2E_TURNSTILE_SECRET_KEY",
  "LOG_HASH_SALT",
] as const;

// Phase-10 verification/narrowing anchors (post step-1).
// These constants are documentation/operator helpers only and must not change runtime behavior.
// Goal: clearly separate "runtime-only confirmed keep" vs "verification-needed" before any alias cleanup PR.
export const PHASE10_RUNTIME_ONLY_CONFIRMED_KEEP_SET = [
  "EDU_OPENAI_PROXY_TOKEN",
  "EDU_OPENAI_PROXY_TIMEOUT_MS",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_LOG_SALT",
  "TURNSTILE_FAIL_OPEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "OPENAI_KEY",
  "E2E_TURNSTILE_SECRET_KEY",
  "LOG_HASH_SALT",
] as const;

export const PHASE10_RUNTIME_ONLY_VERIFICATION_NEEDED_SET = [
  "EDU_OPENAI_PROXY_URL",
  "EDU_OPENAI_PROXY_CHAT_PATH",
  "EDU_OPENAI_PROXY_DECORATE_PATH",
  "EDU_OPENAI_PROXY_HEALTH_PATH",
  "EDU_STUDENT_AI_SAFE_MODE",
  "EDU_STUDENT_COACH_MODE",
  "EDU_DECORATE_FORCE_DETERMINISTIC",
  "EMERGENCY_MODE",
  "EMERGENCY_READONLY",
  "OPS_ADMIN_EMAILS",
  "BUILD_ID",
] as const;

export const PHASE10_FRAMEWORK_INFRA_DIRECT_ENV_EXCEPTIONS = [
  "process.env.NODE_ENV",
  "process.env.NEXT_PUBLIC_* (client bundle gating)",
  "worker env bindings (custom-worker.ts env.*)",
  "worker/eduview process.env (R2 adapter runtime)",
] as const;

// Phase-9 step-1 제외(다음 단계 검증 후 이동):
// - mainline router/config keys (`EDU_OPENAI_PROXY_URL`, `EDU_OPENAI_PROXY_*_PATH`)는 ops 가시성 확인 후 후속 배치
// - student policy keys (`EDU_STUDENT_*`, `EDU_DECORATE_FORCE_DETERMINISTIC`)는 runtime-only 검증 단계에서 이동
// - ops policy keys (`EMERGENCY_*`, `OPS_ADMIN_EMAILS`, `BUILD_ID`)는 운영 런북 계측 확인 후 이동

// Backward-compatible aliases for phase-5 references in docs/scripts.


export const PHASE7_RUNTIME_ENV_BOUNDARY = {
  studentMainline: ["EDU_STUDENT_AI_SAFE_MODE", "EDU_STUDENT_COACH_MODE", "EDU_DECORATE_FORCE_DETERMINISTIC"] as const,
  backendProxyMainline: [
    "EDU_OPENAI_PROXY_URL",
    "EDU_OPENAI_PROXY_TOKEN",
    "EDU_OPENAI_PROXY_CHAT_PATH",
    "EDU_OPENAI_PROXY_DECORATE_PATH",
    "EDU_OPENAI_PROXY_HEALTH_PATH",
    "EDU_OPENAI_PROXY_TIMEOUT_MS",
  ] as const,
  directOpenAiLegacyDebug: ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI_PROJECT_ID", "OPENAI_ORGANIZATION_ID", "OPENAI_MODEL"] as const,
  webllmConditionalLocal: ["NEXT_PUBLIC_EDU_WEBLLM_ENABLE", "NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE", "NEXT_PUBLIC_EDU_WEBLLM_DEBUG"] as const,
  opsRuntime: ["EMERGENCY_MODE", "EMERGENCY_READONLY", "OPS_ADMIN_EMAILS", "BUILD_ID"] as const,
} as const;
export const PHASE6_REMOVE_READY_ALIASES = PHASE8_REMOVE_READY_ALIASES;
export const PHASE6_KEEP_FOR_NOW_ALIASES = PHASE8_KEEP_FOR_NOW_ALIASES;
export const PHASE5_REMOVE_READY_ALIASES = PHASE6_REMOVE_READY_ALIASES;
export const PHASE5_KEEP_FOR_NOW_ALIASES = PHASE6_KEEP_FOR_NOW_ALIASES;

const readBooleanEnv = (key: string, fallback: boolean): boolean => {
  const raw = readEnvString(key);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export const readStudentAiSafeModeEnabled = (): boolean => readBooleanEnv("EDU_STUDENT_AI_SAFE_MODE", true);
export const readDecorateDeterministicForced = (): boolean => readBooleanEnv("EDU_DECORATE_FORCE_DETERMINISTIC", true);

export const readStudentCoachMode = (): StudentCoachMode => {
  const raw = readEnvString("EDU_STUDENT_COACH_MODE")?.toLowerCase();
  if (raw === "disabled" || raw === "guide" || raw === "template" || raw === "backend") return raw;
  return "template";
};

export const readOpenAiDirectDisabled = (): boolean => readBooleanEnv("EDU_OPENAI_DIRECT_DISABLED", true);
// This debug route is deliberately enabled only by the exact server-side value "true".
export const readOpenAiDebugPingEnabled = (): boolean => readEnvString("EDU_OPENAI_DEBUG_PING_ENABLED") === "true";
export const readOpenAiModel = (): string => readEnvString("OPENAI_MODEL") ?? "gpt-4o-mini";
export const readOpenAiProjectId = (): string | undefined => readEnvString("OPENAI_PROJECT_ID");

export const readEduOpenAiProxyBaseUrl = (): string | undefined =>
  // Deprecated runtime fallback (phase-13 deprecate-only): EDU_LLM_ENDPOINT
  // Phase-18 classification: provider-critical/deprecate-only (not actual-cleanup-ready).
  // Keep runtime compatibility until operator verification proves canonical-only usage in all target envs.
  readEnvString("EDU_OPENAI_PROXY_URL") ?? readEnvString("EDU_LLM_ENDPOINT");

export const readEduOpenAiProxyToken = (): string | undefined =>
  // Deprecated runtime fallback (phase-13 deprecate-only): EDU_LLM_API_KEY
  // Phase-18 classification: provider-critical/deprecate-only (not actual-cleanup-ready).
  // Keep runtime compatibility until backend auth/rotation checks confirm canonical-only rollout.
  readEnvString("EDU_OPENAI_PROXY_TOKEN") ?? readEnvString("EDU_LLM_API_KEY");

const DEFAULT_EDU_PROXY_TIMEOUT_MS = 12_000;

export const readEduOpenAiProxyTimeoutMs = (): number => {
  const raw = readEnvString("EDU_OPENAI_PROXY_TIMEOUT_MS");
  if (!raw) return DEFAULT_EDU_PROXY_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return DEFAULT_EDU_PROXY_TIMEOUT_MS;
  return Math.min(30_000, Math.trunc(n));
};

export const readEduOpenAiProxyChatPath = (): string => readEnvString("EDU_OPENAI_PROXY_CHAT_PATH") ?? "/v1/edu/chat";
export const readEduOpenAiProxyDecoratePath = (): string => readEnvString("EDU_OPENAI_PROXY_DECORATE_PATH") ?? "/v1/edu/decorate-plan";
export const readEduOpenAiProxyHealthPath = (): string => readEnvString("EDU_OPENAI_PROXY_HEALTH_PATH") ?? "/v1/health/openai";

export const readWebllmGlobalEnabled = (): boolean => readBooleanEnv("NEXT_PUBLIC_EDU_WEBLLM_ENABLE", true);

export const readMarketingMissionDemoV1Enabled = (): boolean =>
  readBooleanEnv("NEXT_PUBLIC_MARKETING_MISSION_DEMO_V1", false);

export const readPublishDailyQuotaLimit = (): number => DAILY_PUBLISH_LIMIT;

export const readSiteCanonicalUrl = (): string | undefined =>
  readEnvString("NEXT_PUBLIC_SITE_URL") ?? readEnvString("BASE_URL");

export const readSiteShortUrl = (): string | undefined => readEnvString("NEXT_PUBLIC_SHORT_SITE_URL");

export const readEduviewOrigin = (): string => readEnvString("NEXT_PUBLIC_EDUVIEW_ORIGIN") ?? DEFAULT_EDUVIEW_ORIGIN;

export const readEmergencyModeEnabled = (): boolean => readBooleanEnv("EMERGENCY_MODE", false);

export const readEmergencyReadonlyEnabled = (): boolean => readBooleanEnv("EMERGENCY_READONLY", false);

export const readOpsAdminEmailsRaw = (): string => readEnvString("OPS_ADMIN_EMAILS") ?? "";

export const readOpsAdminEmails = (): string[] =>
  readOpsAdminEmailsRaw()
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

export const readSupabasePublicAnonKey = (): string | undefined =>
  // Phase-19 actual cleanup complete: legacy Supabase public aliases were removed from runtime fallback.
  // Canonical-only source-of-truth for runtime/mainline readiness is NEXT_PUBLIC_SUPABASE_ANON_KEY.
  readEnvString("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// Canonical-only readers for mainline/student surfaces that should not implicitly depend on legacy alias behavior.
// readSupabasePublicAnonKey() is now canonical-only after phase-19 cleanup.
export const readSupabaseCanonicalPublicUrl = (): string | undefined => readEnvString("NEXT_PUBLIC_SUPABASE_URL");
export const readSupabaseCanonicalPublicAnonKey = (): string | undefined => readEnvString("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const readSupabaseCanonicalClientEnvReady = (): boolean =>
  Boolean(readSupabaseCanonicalPublicUrl() && readSupabaseCanonicalPublicAnonKey());

export const readTurnstileSiteKey = (): string | undefined => readEnvString("NEXT_PUBLIC_TURNSTILE_SITE_KEY");

export const readTurnstileSecretKey = (): string | undefined => readEnvString("TURNSTILE_SECRET_KEY");

export const readTurnstileBypassSecretKey = (): string | undefined =>
  // Keep-for-now alias: E2E_TURNSTILE_SECRET_KEY (test/e2e scope).
  // Operator validation note (pre-cutover): e2e/ops bridge isolation should be verified before alias removal.
  readTurnstileSecretKey() ?? readEnvString("E2E_TURNSTILE_SECRET_KEY");
export const readTurnstileFailOpen = (): boolean => readBooleanEnv("TURNSTILE_FAIL_OPEN", false);

export const readBuildId = (): string =>
  readEnvString("BUILD_ID") ?? "unknown";

export const readOpenAiApiKeyPresent = (): boolean =>
  // Keep-for-now alias: OPENAI_KEY (direct OpenAI debug/legacy fallback scope, not backend-proxy mainline).
  // Operator validation note (pre-cutover): ensure no mainline path relies on this legacy alias.
  Boolean(readEnvString("OPENAI_API_KEY") ?? readEnvString("OPENAI_KEY"));

export const readTurnstileLogSalt = (): string | undefined =>
  // Keep-for-now alias: LOG_HASH_SALT (ops compatibility fallback; canonical target is TURNSTILE_LOG_SALT).
  // Operator validation note (pre-cutover): telemetry continuity must be validated before removing alias fallback.
  readEnvString("TURNSTILE_LOG_SALT") ?? readEnvString("LOG_HASH_SALT");

export const appConfig = {
  student: {
    get safeMode() {
      return readStudentAiSafeModeEnabled();
    },
    get coachMode() {
      return readStudentCoachMode();
    },
    get decorateDeterministic() {
      return readDecorateDeterministicForced();
    },
  },
  openai: {
    get directDisabled() {
      return readOpenAiDirectDisabled();
    },
    get apiKeyPresent() {
      // OPENAI_KEY is legacy alias; direct OpenAI path is debug/legacy fallback scope.
      return readOpenAiApiKeyPresent();
    },
    get projectId() {
      return readOpenAiProjectId();
    },
    get model() {
      return readOpenAiModel();
    },
  },
  proxy: {
    get baseUrl() {
      return readEduOpenAiProxyBaseUrl();
    },
    get token() {
      return readEduOpenAiProxyToken();
    },
    get chatPath() {
      return readEduOpenAiProxyChatPath();
    },
    get decoratePath() {
      return readEduOpenAiProxyDecoratePath();
    },
    get healthPath() {
      return readEduOpenAiProxyHealthPath();
    },
    get timeoutMs() {
      return readEduOpenAiProxyTimeoutMs();
    },
  },
  webllm: {
    get enabled() {
      return readWebllmGlobalEnabled();
    },
    get hardDisabled() {
      return readBooleanEnv("NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE", false);
    },
    get debug() {
      return readBooleanEnv("NEXT_PUBLIC_EDU_WEBLLM_DEBUG", false);
    },
  },
  ops: {
    get emergencyMode() {
      return readEmergencyModeEnabled();
    },
    get adminEmails() {
      return readOpsAdminEmails();
    },
    get buildId() {
      return readBuildId();
    },
  },
  site: {
    get canonicalUrl() {
      return readSiteCanonicalUrl();
    },
    get shortUrl() {
      return readSiteShortUrl();
    },
    get eduviewOrigin() {
      return readEduviewOrigin();
    },
  },
  turnstile: {
    get siteKey() {
      return readTurnstileSiteKey();
    },
    get secretKey() {
      return readTurnstileSecretKey();
    },
    get bypassSecretKey() {
      return readTurnstileBypassSecretKey();
    },
    get failOpen() {
      return readTurnstileFailOpen();
    },
  },
  supabase: {
    get publicAnonKey() {
      return readSupabasePublicAnonKey();
    },
  },
} as const;
