/*
 * legacy is the fail-safe default.
 * secured_v1 must be explicitly configured.
 * This runtime result does not activate the secured commit path by itself.
 */

import {
  getRuntimeEnv,
  readEnvStringFrom,
  type RuntimeEnv,
} from "@/lib/server/runtimeEnv";

export const EDU_PUBLISH_COMMIT_ATTEMPT_MODES = [
  "legacy",
  "secured_v1",
] as const;

export type EduPublishCommitAttemptMode =
  (typeof EDU_PUBLISH_COMMIT_ATTEMPT_MODES)[number];

export const EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV =
  "EDU_PUBLISH_COMMIT_ATTEMPT_MODE" as const;

export type EduPublishCommitAttemptModeRuntimeSource =
  | "default"
  | "configured"
  | "invalid_fallback"
  | "evaluation_failed_fallback";

export type EduPublishCommitAttemptModeRuntimeResult = {
  mode: EduPublishCommitAttemptMode;
  source: EduPublishCommitAttemptModeRuntimeSource;
};

const DEFAULT_RESULT: EduPublishCommitAttemptModeRuntimeResult = {
  mode: "legacy",
  source: "default",
};

const INVALID_FALLBACK_RESULT: EduPublishCommitAttemptModeRuntimeResult = {
  mode: "legacy",
  source: "invalid_fallback",
};

const EVALUATION_FAILED_FALLBACK_RESULT: EduPublishCommitAttemptModeRuntimeResult = {
  mode: "legacy",
  source: "evaluation_failed_fallback",
};

export function parseEduPublishCommitAttemptMode(
  value: unknown,
): EduPublishCommitAttemptModeRuntimeResult {
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

export function loadEduPublishCommitAttemptMode(
  source?: RuntimeEnv,
): EduPublishCommitAttemptModeRuntimeResult {
  try {
    const runtimeSource = source ?? getRuntimeEnv();
    return parseEduPublishCommitAttemptMode(
      readEnvStringFrom(
        runtimeSource,
        EDU_PUBLISH_COMMIT_ATTEMPT_MODE_ENV,
      ),
    );
  } catch {
    return { ...EVALUATION_FAILED_FALLBACK_RESULT };
  }
}
