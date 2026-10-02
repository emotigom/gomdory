import assert from "node:assert/strict";
import test from "node:test";

import { resolveLessonWebllmExperimentAuditRecord } from "@/lib/edu/lesson/lessonWebllmExperimentAudit";
import type { LessonWebllmDispatchSelectorResult } from "@/lib/edu/lesson/lessonWebllmDispatchSelector";
import type {
  LessonWebllmContainedDispatchPlan,
  LessonWebllmExperimentOutcome,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";

const selectorBase = (): LessonWebllmDispatchSelectorResult => ({
  dispatchMode: "openai_mainline",
  wouldDispatchToWebllm: false,
  reason: "dispatch_experiment_off",
  experimentScope: "off",
  guardrails: {
    explicitOptInRequired: true,
    preserveCoachDecorateMainline: true,
    rollbackSafeDefaultMainline: true,
    explicitDispatchKillSwitch: true,
    boundedLessonRolloutScope: true,
  },
});

const planBase = (): LessonWebllmContainedDispatchPlan => ({
  attemptLocalDispatch: false,
  fallbackReason: "blocked",
  noAttemptReason: "blocked",
});

const outcomeBase = (): LessonWebllmExperimentOutcome => ({
  attemptState: "no_attempt",
  noAttemptReason: "blocked",
  fallbackReason: "blocked",
  successReason: null,
});

test("audit contract reports in-scope blocked policy path as no-attempt fallback", () => {
  const audit = resolveLessonWebllmExperimentAuditRecord({
    selector: {
      ...selectorBase(),
      reason: "activation_not_ready",
      experimentScope: "in_scope_but_blocked",
    },
    plan: planBase(),
    outcome: outcomeBase(),
  });

  assert.deepEqual(audit, {
    inRolloutScope: true,
    blockCategory: "policy",
    dispatchAttempted: false,
    fallbackOccurred: true,
    stage: "rollout_blocked",
    result: "fallback",
    reason: "blocked",
  });
});

test("audit contract reports kill-switch blocked path", () => {
  const audit = resolveLessonWebllmExperimentAuditRecord({
    selector: {
      ...selectorBase(),
      reason: "dispatch_kill_switch_on",
      experimentScope: "off",
    },
    plan: planBase(),
    outcome: outcomeBase(),
  });

  assert.equal(audit.inRolloutScope, false);
  assert.equal(audit.blockCategory, "kill_switch");
  assert.equal(audit.dispatchAttempted, false);
  assert.equal(audit.result, "fallback");
});

test("audit contract reports attempted dispatch fallback", () => {
  const audit = resolveLessonWebllmExperimentAuditRecord({
    selector: {
      ...selectorBase(),
      dispatchMode: "webllm_contained",
      wouldDispatchToWebllm: true,
      reason: "contained_dispatch_enabled",
      experimentScope: "in_scope_eligible",
    },
    plan: {
      attemptLocalDispatch: true,
      fallbackReason: null,
      noAttemptReason: null,
    },
    outcome: {
      attemptState: "attempted",
      noAttemptReason: null,
      fallbackReason: "timeout",
      successReason: null,
    },
  });

  assert.deepEqual(audit, {
    inRolloutScope: true,
    blockCategory: "none",
    dispatchAttempted: true,
    fallbackOccurred: true,
    stage: "dispatch_attempted",
    result: "fallback",
    reason: "timeout",
  });
});

test("audit contract reports attempted dispatch success", () => {
  const audit = resolveLessonWebllmExperimentAuditRecord({
    selector: {
      ...selectorBase(),
      dispatchMode: "webllm_contained",
      wouldDispatchToWebllm: true,
      reason: "contained_dispatch_enabled",
      experimentScope: "in_scope_eligible",
    },
    plan: {
      attemptLocalDispatch: true,
      fallbackReason: null,
      noAttemptReason: null,
    },
    outcome: {
      attemptState: "attempted",
      noAttemptReason: null,
      fallbackReason: null,
      successReason: "local_dispatch_succeeded",
    },
  });

  assert.deepEqual(audit, {
    inRolloutScope: true,
    blockCategory: "none",
    dispatchAttempted: true,
    fallbackOccurred: false,
    stage: "dispatch_attempted",
    result: "success",
    reason: "contained_dispatch_enabled",
  });
});
