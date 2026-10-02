/*
 * legacy is the fail-safe default.
 * secured_v1 must be explicitly configured and remains inactive until the
 * prepare handler consumes this runtime result.
 */

import {
  getRuntimeEnv,
  readEnvStringFrom,
  type RuntimeEnv,
} from "@/lib/server/runtimeEnv";

export const EDU_PUBLISH_PREPARE_ATTEMPT_MODES = [
  "legacy",
  "secured_v1",
] as const;

export type EduPublishPrepareAttemptMode =
  (typeof EDU_PUBLISH_PREPARE_ATTEMPT_MODES)[number];

export const EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV =
  "EDU_PUBLISH_PREPARE_ATTEMPT_MODE" as const;

export type EduPublishPrepareAttemptModeRuntimeSource =
  | "default"
  | "configured"
  | "invalid_fallback"
  | "evaluation_failed_fallback";

export type EduPublishPrepareAttemptModeRuntimeResult = {
  mode: EduPublishPrepareAttemptMode;
  source: EduPublishPrepareAttemptModeRuntimeSource;
};

const DEFAULT_RESULT: EduPublishPrepareAttemptModeRuntimeResult = {
  mode: "legacy",
  source: "default",
};

const INVALID_FALLBACK_RESULT: EduPublishPrepareAttemptModeRuntimeResult = {
  mode: "legacy",
  source: "invalid_fallback",
};

const EVALUATION_FAILED_FALLBACK_RESULT: EduPublishPrepareAttemptModeRuntimeResult = {
  mode: "legacy",
  source: "evaluation_failed_fallback",
};

export function parseEduPublishPrepareAttemptMode(
  value: unknown,
): EduPublishPrepareAttemptModeRuntimeResult {
  if (value === undefined || value === null) return { ...DEFAULT_RESULT };
  if (typeof value !== "string") return { ...INVALID_FALLBACK_RESULT };

  const normalized = value.trim();
  if (!normalized) return { ...DEFAULT_RESULT };
  if (normalized === "legacy") return { mode: "legacy", source: "configured" };
  if (normalized === "secured_v1") {
    return { mode: "secured_v1", source: "configured" };
  }
  return { ...INVALID_FALLBACK_RESULT };
}

export function loadEduPublishPrepareAttemptMode(
  source?: RuntimeEnv,
): EduPublishPrepareAttemptModeRuntimeResult {
  try {
    const runtimeSource = source ?? getRuntimeEnv();
    return parseEduPublishPrepareAttemptMode(
      readEnvStringFrom(
        runtimeSource,
        EDU_PUBLISH_PREPARE_ATTEMPT_MODE_ENV,
      ),
    );
  } catch {
    return { ...EVALUATION_FAILED_FALLBACK_RESULT };
  }
}
