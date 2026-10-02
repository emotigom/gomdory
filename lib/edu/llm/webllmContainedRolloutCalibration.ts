import type {
  WebllmContainedAttemptEvidence,
  WebllmContainedAttemptOutcome,
} from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import type { WebllmContainedOperatorState } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";

export type WebllmContainedHandoffDecision = "go" | "hold" | "stop";
export type WebllmContainedRolloutConfidence = "low" | "medium" | "high";

export const WEBLLM_CONTAINED_ROLLOUT_CALIBRATION = {
  recentEvidenceWindowSize: 5,
  minimumRecentSuccessesForGo: 2,
  repeatedNoResponseStopThreshold: 2,
  repeatedTimeoutHoldThreshold: 2,
  repeatedFallbackOnlyHoldThreshold: 2,
  engineErrorStopThreshold: 1,
  blockedOutcomeStopThreshold: 1,
} as const;

type WebllmContainedCounts = {
  successes: number;
  timeouts: number;
  noResponses: number;
  engineErrors: number;
  blocked: number;
  fallbackOnly: number;
};

export type WebllmContainedRolloutEvidenceSummary = {
  windowSize: number;
  rows: WebllmContainedAttemptEvidence[];
  counts: WebllmContainedCounts;
};

export type ResolveWebllmContainedRolloutDecisionInput = {
  operatorState: WebllmContainedOperatorState;
  evidenceRows: WebllmContainedAttemptEvidence[];
};

export type WebllmContainedRolloutDecision = {
  decision: WebllmContainedHandoffDecision;
  decisionReason: string;
  confidence: WebllmContainedRolloutConfidence;
  counts: WebllmContainedCounts;
  triggeredRules: string[];
  windowSize: number;
};

const STOP_OPERATOR_STATES = new Set<WebllmContainedOperatorState>(["blocked_safe"]);

const HOLD_OPERATOR_STATES = new Set<WebllmContainedOperatorState>([
  "fallback_only",
  "degraded_hold",
  "canonical_not_ready",
  "health_not_ready",
  "env_not_ready",
  "out_of_rollout_scope",
]);

const countOutcome = (rows: WebllmContainedAttemptEvidence[], outcome: WebllmContainedAttemptOutcome): number =>
  rows.reduce((total, row) => total + (row.outcome === outcome ? 1 : 0), 0);

export const summarizeRecentContainedRolloutEvidence = (
  evidenceRows: WebllmContainedAttemptEvidence[],
): WebllmContainedRolloutEvidenceSummary => {
  const rows = evidenceRows.slice(0, WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.recentEvidenceWindowSize);
  return {
    windowSize: rows.length,
    rows,
    counts: {
      successes: countOutcome(rows, "success"),
      timeouts: countOutcome(rows, "timeout"),
      noResponses: countOutcome(rows, "no_response"),
      engineErrors: countOutcome(rows, "engine_error"),
      blocked: countOutcome(rows, "blocked"),
      fallbackOnly: countOutcome(rows, "fallback_only"),
    },
  };
};

export const resolveWebllmContainedRolloutDecision = (
  input: ResolveWebllmContainedRolloutDecisionInput,
): WebllmContainedRolloutDecision => {
  const summary = summarizeRecentContainedRolloutEvidence(input.evidenceRows);
  const { counts } = summary;
  const triggeredRules: string[] = [];

  if (STOP_OPERATOR_STATES.has(input.operatorState)) {
    triggeredRules.push("operator_state_blocked_safe_stop");
  }
  if (counts.blocked >= WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.blockedOutcomeStopThreshold) {
    triggeredRules.push("recent_blocked_outcome_stop");
  }
  if (counts.engineErrors >= WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.engineErrorStopThreshold) {
    triggeredRules.push("engine_error_escalates_fast_stop");
  }
  if (counts.noResponses >= WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.repeatedNoResponseStopThreshold) {
    triggeredRules.push("repeated_no_response_stop");
  }
  if (counts.timeouts >= WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.repeatedTimeoutHoldThreshold) {
    triggeredRules.push("repeated_timeout_hold");
  }
  if (counts.fallbackOnly >= WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.repeatedFallbackOnlyHoldThreshold) {
    triggeredRules.push("repeated_fallback_only_hold");
  }
  if (HOLD_OPERATOR_STATES.has(input.operatorState)) {
    triggeredRules.push("operator_state_hold");
  }

  const hasStopRule = triggeredRules.some((rule) => rule.endsWith("_stop"));
  const hasHoldRule = triggeredRules.some((rule) => rule.endsWith("_hold"));
  const cleanSuccessWindow =
    input.operatorState === "ready_to_attempt" &&
    counts.successes >= WEBLLM_CONTAINED_ROLLOUT_CALIBRATION.minimumRecentSuccessesForGo &&
    counts.timeouts === 0 &&
    counts.noResponses === 0 &&
    counts.engineErrors === 0 &&
    counts.blocked === 0 &&
    counts.fallbackOnly === 0;

  if (cleanSuccessWindow) {
    triggeredRules.push("clean_success_window_go");
  }

  const decision: WebllmContainedHandoffDecision = hasStopRule ? "stop" : cleanSuccessWindow ? "go" : "hold";

  const confidence: WebllmContainedRolloutConfidence =
    decision === "go"
      ? "high"
      : decision === "stop"
        ? "high"
        : hasHoldRule || HOLD_OPERATOR_STATES.has(input.operatorState)
          ? "medium"
          : "low";

  const decisionReason =
    decision === "go"
      ? "clean_recent_success_window"
      : decision === "stop"
        ? triggeredRules.find((rule) => rule.endsWith("_stop")) ?? "stop_rule_triggered"
        : triggeredRules.find((rule) => rule.endsWith("_hold")) ?? "additional_evidence_required";

  return {
    decision,
    decisionReason,
    confidence,
    counts,
    triggeredRules,
    windowSize: summary.windowSize,
  };
};
