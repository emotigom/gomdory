import type { EduFeatureFlags } from "@/lib/edu/featureFlags";
import { parseBool } from "@/lib/env/parseBool";
import { readWebllmEnvValue } from "@/lib/edu/llm/webllmConfig";
import { resolveHardDisable } from "@/lib/edu/llm/webllmResolvedConfig";

export const normalizeBoolean = parseBool;

const toNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getWebLLMLabsFlag = () => normalizeBoolean(process.env.NEXT_PUBLIC_EDU_WEBLLM_LABS, false);

export const getEduWebLLMEnableFlag = () => {
  const canonical = process.env.NEXT_PUBLIC_EDU_WEBLLM_ENABLE;
  return normalizeBoolean(canonical, true);
};

export const getEduWebLLMHardDisableFlag = () =>
  resolveHardDisable(
    readWebllmEnvValue("EDU_WEBLLM_HARD_DISABLE") ??
      readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE"),
  );

export const getEduWebLLMPrefetchFlag = () =>
  normalizeBoolean(process.env.NEXT_PUBLIC_EDU_WEBLLM_PREFETCH, true);

export const getEduWebLLMAutoTierFlag = () =>
  normalizeBoolean(process.env.NEXT_PUBLIC_EDU_WEBLLM_AUTO_TIER, true);

export const getEduWebLLMInitTimeoutMs = () =>
  toNumber(process.env.NEXT_PUBLIC_EDU_WEBLLM_INIT_TIMEOUT_MS, 45_000);

export const getEduWebLLMLastGoodTtlMs = () =>
  toNumber(process.env.NEXT_PUBLIC_EDU_WEBLLM_LASTGOOD_TTL_MS, 7 * 24 * 60 * 60 * 1000);


export type WebLLMEnableReasonCode = "enabled" | "flag_disabled" | "user_disabled";

export type WebLLMEnableDecision = {
  enabled: boolean;
  reasonCode: WebLLMEnableReasonCode;
};

export const evaluateWebLLMEnablement = (options?: {
  featureFlags?: Pick<EduFeatureFlags, "webllmFeatureEnabled" | "webllmEnabled"> | null;
}): WebLLMEnableDecision => {
  if (!getEduWebLLMEnableFlag()) {
    return { enabled: false, reasonCode: "flag_disabled" };
  }

  if (options?.featureFlags?.webllmFeatureEnabled === false || options?.featureFlags?.webllmEnabled === false) {
    return { enabled: false, reasonCode: "user_disabled" };
  }

  return { enabled: true, reasonCode: "enabled" };
};

export const shouldEnableWebLLM = (options?: {
  featureFlags?: Pick<EduFeatureFlags, "webllmFeatureEnabled" | "webllmEnabled"> | null;
}) => evaluateWebLLMEnablement(options).enabled;
