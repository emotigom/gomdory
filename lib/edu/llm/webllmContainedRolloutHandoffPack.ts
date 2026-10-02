import type { WebllmContainedAttemptEvidence } from "@/lib/edu/llm/webllmContainedRolloutEvidence";
import {
  resolveWebllmContainedRolloutDecision,
  summarizeRecentContainedRolloutEvidence,
  type WebllmContainedHandoffDecision,
} from "@/lib/edu/llm/webllmContainedRolloutCalibration";
import type {
  WebllmContainedOperatorState,
  WebllmContainedRolloutSnapshot,
} from "@/lib/edu/llm/webllmContainedRolloutSnapshot";

type WebllmContainedRequiredCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export type WebllmContainedRolloutHandoffPack = {
  decision: WebllmContainedHandoffDecision;
  headline: string;
  summary: string;
  currentOperatorState: WebllmContainedOperatorState;
  recentWindowSummary: string;
  requiredChecks: WebllmContainedRequiredCheck[];
  evidenceBullets: string[];
  safeCopyText: string;
  safeJson: {
    decision: WebllmContainedHandoffDecision;
    headline: string;
    summary: string;
    currentOperatorState: WebllmContainedOperatorState;
    recentWindowSummary: string;
    requiredChecks: WebllmContainedRequiredCheck[];
    evidenceBullets: string[];
    generatedAt: string;
  };
  generatedAt: string;
};

const sanitizeLine = (value: string) =>
  value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);

export const buildWebllmContainedRolloutHandoffPack = (input: {
  snapshot: WebllmContainedRolloutSnapshot;
  evidenceRows: WebllmContainedAttemptEvidence[];
  generatedAt?: string | null;
}): WebllmContainedRolloutHandoffPack => {
  const generatedAt = input.generatedAt ? new Date(input.generatedAt).toISOString() : new Date().toISOString();
  const snapshot = input.snapshot;
  const recentSummary = summarizeRecentContainedRolloutEvidence(input.evidenceRows);
  const decisionResult = resolveWebllmContainedRolloutDecision({
    operatorState: snapshot.operatorState,
    evidenceRows: input.evidenceRows,
  });
  const { counts } = decisionResult;
  const decision = decisionResult.decision;

  const requiredChecks: WebllmContainedRequiredCheck[] = [
    { key: "operator_state", label: "operator state is ready_to_attempt", ok: snapshot.operatorState === "ready_to_attempt" },
    { key: "canonical", label: "canonical assets ready", ok: snapshot.canonicalReady },
    { key: "health", label: "health ready", ok: snapshot.healthReady },
    { key: "kill_switch", label: "kill switch is off", ok: !snapshot.killSwitchOn },
    {
      key: "recent_stop_signals",
      label: "recent window has no calibrated stop-pattern signals",
      ok: decisionResult.decision !== "stop",
    },
  ];

  const recentWindowSummary =
    recentSummary.windowSize === 0
      ? "No recent contained attempts recorded yet."
      : `Recent ${recentSummary.windowSize} attempts: success=${counts.successes}, timeout=${counts.timeouts}, engine_error=${counts.engineErrors}, no_response=${counts.noResponses}, fallback_only=${counts.fallbackOnly}.`;

  const headline =
    decision === "go"
      ? "GO: narrow contained window can continue"
      : decision === "hold"
        ? "HOLD: keep mainline-safe posture and collect more evidence"
        : "STOP: immediate stop/rollback posture required";

  const summary = sanitizeLine(
    `${snapshot.summaryLabel}. ${recentWindowSummary} Dispatch=${snapshot.dispatchExperiment}, activation=${snapshot.activationExperiment}.`,
  );

  const evidenceBullets = [
    `Operator state: ${snapshot.operatorState}`,
    `Scope: ${snapshot.lessonScope}; kill switch: ${snapshot.killSwitchOn ? "on" : "off"}`,
    `Readiness: bootstrap=${snapshot.bootstrapReady ? "ready" : "not_ready"}, canonical=${snapshot.canonicalReady ? "ready" : "not_ready"}, health=${snapshot.healthReady ? "ready" : "not_ready"}`,
    `Calibrated decision reason: ${decisionResult.decisionReason}; confidence=${decisionResult.confidence}; rules=${decisionResult.triggeredRules.join(",") || "none"}`,
    recentWindowSummary,
  ].map(sanitizeLine);

  const safeJson = {
    decision,
    headline,
    summary,
    currentOperatorState: snapshot.operatorState,
    recentWindowSummary,
    requiredChecks,
    evidenceBullets,
    generatedAt,
  };

  const safeCopyText = [
    "# WebLLM Contained Go/No-Go Handoff",
    `- Verdict: ${decision.toUpperCase()}`,
    `- Headline: ${headline}`,
    `- Operator state: ${snapshot.operatorState}`,
    `- Summary: ${summary}`,
    `- Recent window: ${recentWindowSummary}`,
    `- Decision reason: ${decisionResult.decisionReason}`,
    `- Confidence: ${decisionResult.confidence}`,
    `- Triggered rules: ${decisionResult.triggeredRules.join(",") || "none"}`,
    "- Required checks:",
    ...requiredChecks.map((check) => `  - [${check.ok ? "x" : " "}] ${check.label}`),
    "- Evidence:",
    ...evidenceBullets.map((line) => `  - ${line}`),
    `- generatedAt: ${generatedAt}`,
  ]
    .map(sanitizeLine)
    .join("\n");

  return {
    decision,
    headline,
    summary,
    currentOperatorState: snapshot.operatorState,
    recentWindowSummary,
    requiredChecks,
    evidenceBullets,
    safeCopyText,
    safeJson,
    generatedAt,
  };
};
