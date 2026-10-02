export type WebllmContainedOperatorState =
  | "ready_to_attempt"
  | "fallback_only"
  | "blocked_safe"
  | "out_of_rollout_scope"
  | "degraded_hold"
  | "canonical_not_ready"
  | "health_not_ready"
  | "env_not_ready";

export type WebllmContainedLessonScope = "allowlisted" | "not_allowlisted" | "unknown";

export type WebllmContainedRolloutSnapshot = {
  operatorState: WebllmContainedOperatorState;
  summaryLabel: string;
  lessonScope: WebllmContainedLessonScope;
  bootstrapReady: boolean;
  canonicalReady: boolean;
  healthReady: boolean;
  degradedBlocked: boolean;
  killSwitchOn: boolean;
  dispatchExperiment: string;
  activationExperiment: string;
  shouldAttemptLocalInit: boolean;
  shouldUseServerFallback: boolean;
  canonicalStatus: string | null;
  statusCode: string | null;
  invalidReasons: string[];
  safeEvidenceRows: Array<{ key: string; label: string; value: string; ok: boolean }>;
  safeAuditSummary: string;
};

export type ResolveWebllmContainedRolloutSnapshotInput = {
  lessonScope?: WebllmContainedLessonScope;
  bootstrapReady?: boolean;
  canonicalReady?: boolean;
  healthReady?: boolean;
  degradedBlocked?: boolean;
  killSwitchOn?: boolean;
  dispatchExperiment?: string | null;
  activationExperiment?: string | null;
  shouldAttemptLocalInit?: boolean;
  shouldUseServerFallback?: boolean;
  canonicalStatus?: string | null;
  statusCode?: string | null;
  invalidReasons?: string[] | null;
};

const normalizeExperiment = (value: string | null | undefined, fallback: string): string => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toSummaryLabel: Record<WebllmContainedOperatorState, string> = {
  ready_to_attempt: "Contained lane ready to attempt",
  fallback_only: "Contained lane fallback-only",
  blocked_safe: "Contained lane blocked-safe",
  out_of_rollout_scope: "Out of rollout scope",
  degraded_hold: "Contained lane on degraded hold",
  canonical_not_ready: "Canonical assets not ready",
  health_not_ready: "Health checks not ready",
  env_not_ready: "WebLLM env not ready",
};

const boolLabel = (value: boolean) => (value ? "yes" : "no");

export const resolveWebllmContainedRolloutSnapshot = (
  input: ResolveWebllmContainedRolloutSnapshotInput,
): WebllmContainedRolloutSnapshot => {
  const lessonScope = input.lessonScope ?? "unknown";
  const bootstrapReady = input.bootstrapReady ?? false;
  const canonicalReady = input.canonicalReady ?? false;
  const healthReady = input.healthReady ?? false;
  const degradedBlocked = input.degradedBlocked ?? false;
  const killSwitchOn = input.killSwitchOn ?? false;
  const shouldAttemptLocalInit = input.shouldAttemptLocalInit ?? false;
  const shouldUseServerFallback = input.shouldUseServerFallback ?? !shouldAttemptLocalInit;
  const dispatchExperiment = normalizeExperiment(input.dispatchExperiment, "off");
  const activationExperiment = normalizeExperiment(input.activationExperiment, "off");
  const invalidReasons = [...(input.invalidReasons ?? [])];

  let operatorState: WebllmContainedOperatorState;
  if (lessonScope === "not_allowlisted") {
    operatorState = "out_of_rollout_scope";
  } else if (killSwitchOn) {
    operatorState = "blocked_safe";
  } else if (!bootstrapReady) {
    operatorState = "fallback_only";
  } else if (!canonicalReady) {
    operatorState = "canonical_not_ready";
  } else if (degradedBlocked) {
    operatorState = "degraded_hold";
  } else if (!healthReady) {
    operatorState = "health_not_ready";
  } else if (!shouldAttemptLocalInit) {
    operatorState = "fallback_only";
  } else {
    operatorState = "ready_to_attempt";
  }

  if (operatorState !== "out_of_rollout_scope" && operatorState !== "blocked_safe" && !bootstrapReady) {
    operatorState = "env_not_ready";
  }

  const summaryLabel = toSummaryLabel[operatorState];

  const safeEvidenceRows = [
    { key: "lesson_scope", label: "allowlist scope", value: lessonScope, ok: lessonScope !== "not_allowlisted" },
    { key: "kill_switch", label: "kill switch", value: boolLabel(killSwitchOn), ok: !killSwitchOn },
    { key: "bootstrap", label: "bootstrap ready", value: boolLabel(bootstrapReady), ok: bootstrapReady },
    { key: "canonical", label: "canonical assets", value: boolLabel(canonicalReady), ok: canonicalReady },
    { key: "health", label: "health ready", value: boolLabel(healthReady), ok: healthReady },
    { key: "degraded", label: "degraded blocked", value: boolLabel(degradedBlocked), ok: !degradedBlocked },
    { key: "fallback", label: "server fallback", value: boolLabel(shouldUseServerFallback), ok: true },
  ];

  return {
    operatorState,
    summaryLabel,
    lessonScope,
    bootstrapReady,
    canonicalReady,
    healthReady,
    degradedBlocked,
    killSwitchOn,
    dispatchExperiment,
    activationExperiment,
    shouldAttemptLocalInit,
    shouldUseServerFallback,
    canonicalStatus: input.canonicalStatus ?? null,
    statusCode: input.statusCode ?? null,
    invalidReasons,
    safeEvidenceRows,
    safeAuditSummary: `${summaryLabel}. dispatch=${dispatchExperiment}, activation=${activationExperiment}, fallback=${boolLabel(shouldUseServerFallback)}`,
  };
};

export const isContainedRolloutReadyToAttempt = (
  operatorState: WebllmContainedOperatorState,
): boolean => operatorState === "ready_to_attempt";
