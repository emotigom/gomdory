import type { EduPublishCapabilityPolicyMode } from "@/lib/edu/publish/commitCapabilityPolicy";
import {
  getRuntimeEnv,
  readEnvStringFrom,
  type RuntimeEnv,
} from "@/lib/server/runtimeEnv";

export const EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV =
  "EDU_PUBLISH_CAPABILITY_POLICY_MODE" as const;

export type EduPublishCapabilityPolicyRuntimeSource =
  | "default"
  | "configured"
  | "invalid_fallback"
  | "evaluation_failed_fallback";

export type EduPublishCapabilityPolicyRuntimeResult = {
  mode: EduPublishCapabilityPolicyMode;
  source: EduPublishCapabilityPolicyRuntimeSource;
};

const DEFAULT_RESULT: EduPublishCapabilityPolicyRuntimeResult = {
  mode: "observe",
  source: "default",
};

const INVALID_FALLBACK_RESULT: EduPublishCapabilityPolicyRuntimeResult = {
  mode: "observe",
  source: "invalid_fallback",
};

const EVALUATION_FAILED_FALLBACK_RESULT: EduPublishCapabilityPolicyRuntimeResult = {
  mode: "observe",
  source: "evaluation_failed_fallback",
};

export function parseEduPublishCapabilityPolicyMode(
  value: unknown,
): EduPublishCapabilityPolicyRuntimeResult {
  if (value === undefined || value === null) return { ...DEFAULT_RESULT };
  if (typeof value !== "string") return { ...INVALID_FALLBACK_RESULT };

  const normalized = value.trim();
  if (!normalized) return { ...DEFAULT_RESULT };
  if (normalized === "observe") return { mode: "observe", source: "configured" };
  if (normalized === "enforce_present") {
    return { mode: "enforce_present", source: "configured" };
  }
  return { ...INVALID_FALLBACK_RESULT };
}

export function loadEduPublishCapabilityPolicyMode(
  source?: RuntimeEnv,
): EduPublishCapabilityPolicyRuntimeResult {
  try {
    const runtimeSource = source ?? getRuntimeEnv();
    return parseEduPublishCapabilityPolicyMode(
      readEnvStringFrom(
        runtimeSource,
        EDU_PUBLISH_CAPABILITY_POLICY_MODE_ENV,
      ),
    );
  } catch {
    return { ...EVALUATION_FAILED_FALLBACK_RESULT };
  }
}
