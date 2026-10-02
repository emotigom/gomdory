import {
  EDU_FEATURE_FLAGS_DEFAULTS,
  normalizeEduFeatureFlags,
  type EduFeatureFlags,
} from "@/lib/edu/featureFlags";
import { apiV1Path } from "@/lib/standards/pathTypes";

const FEATURE_FLAGS_TIMEOUT_MS = 2_000;

const mapFailureKind = (status: number): "auth_error" | "env_missing" | "fetch_blocked" => {
  if (status === 401) return "auth_error";
  if (status === 403 || status === 429) return "fetch_blocked";
  return "env_missing";
};

const withTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const safeDefaults = (reason: string, errorKind: "auth_error" | "env_missing" | "fetch_blocked" = "env_missing"): EduFeatureFlags => ({
  ...EDU_FEATURE_FLAGS_DEFAULTS,
  reason,
  reasons: [reason],
  allowlistDecision: "not_applicable",
  userFlagsPresent: false,
  errorKind,
});

export async function fetchEduFeatureFlags(): Promise<EduFeatureFlags> {
  try {
    const response = await withTimeout(
      apiV1Path("edu/feature-flags"),
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
      FEATURE_FLAGS_TIMEOUT_MS,
    );
    if (!response.ok) {
      const failureKind = mapFailureKind(response.status);
      const reason = response.status === 401 ? "unauthorized" : "request_failed";
      return safeDefaults(reason, failureKind);
    }

    const json = (await response.json()) as Partial<EduFeatureFlags> | null;
    const normalized = normalizeEduFeatureFlags(json, typeof json?.reason === "string" ? json.reason : "default");
    return {
      ...normalized,
      reasons: Array.isArray(json?.reasons)
        ? json.reasons.filter((item): item is string => typeof item === "string")
        : [normalized.reason],
      gatingMode:
        json?.gatingMode === "user_only" ||
        json?.gatingMode === "pilot_allowlist" ||
        json?.gatingMode === "join_token" ||
        json?.gatingMode === "sample_lesson" ||
        json?.gatingMode === "disabled"
          ? json.gatingMode
          : undefined,
      allowlistDecision:
        json?.allowlistDecision === "allowed" ||
        json?.allowlistDecision === "blocked" ||
        json?.allowlistDecision === "not_applicable"
          ? json.allowlistDecision
          : "not_applicable",
      userFlagsPresent: json?.userFlagsPresent === true,
      errorKind:
        json?.errorKind === "auth_error" ||
        json?.errorKind === "env_missing" ||
        json?.errorKind === "fetch_blocked" ||
        json?.errorKind === "ok"
          ? json.errorKind
          : undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return safeDefaults("timeout", "fetch_blocked");
    }
    return safeDefaults("network_error", "fetch_blocked");
  }
}
