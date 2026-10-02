import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLessonWebllmExperimentOutcome,
  resolveLessonWebllmContainedDispatchPlan,
  shouldFallbackToOpenAiMainline,
} from "@/lib/edu/lesson/lessonWebllmLiveDispatchExperiment";

test("contained dispatch plan keeps default behavior unchanged when selector does not opt in", () => {
  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: true,
    wouldDispatchToWebllm: false,
    initialStatus: "READY",
    degradedRetryAllowed: true,
  });

  assert.deepEqual(plan, {
    attemptLocalDispatch: false,
    fallbackReason: "blocked",
    noAttemptReason: "blocked",
  });
});

test("contained dispatch plan keeps non-opt-in/ineligible paths on mainline fallback", () => {
  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: false,
    wouldDispatchToWebllm: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
  });

  assert.deepEqual(plan, {
    attemptLocalDispatch: false,
    fallbackReason: "not_ready",
    noAttemptReason: "not_ready",
  });
});

test("contained dispatch plan attempts WebLLM only when opt-in eligible and status is ready", () => {
  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: true,
    wouldDispatchToWebllm: true,
    initialStatus: "READY",
    degradedRetryAllowed: false,
  });

  assert.deepEqual(plan, {
    attemptLocalDispatch: true,
    fallbackReason: null,
    noAttemptReason: null,
  });
});

test("contained dispatch plan allows degraded local retry when retry is explicitly allowed", () => {
  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: true,
    wouldDispatchToWebllm: true,
    initialStatus: "DEGRADED",
    degradedRetryAllowed: true,
  });

  assert.deepEqual(plan, {
    attemptLocalDispatch: true,
    fallbackReason: null,
    noAttemptReason: null,
  });
});

test("contained dispatch plan falls back safely when degraded retry is not allowed", () => {
  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: true,
    effectiveWebllmEnabled: true,
    wouldDispatchToWebllm: true,
    initialStatus: "DEGRADED",
    degradedRetryAllowed: false,
  });

  assert.deepEqual(plan, {
    attemptLocalDispatch: false,
    fallbackReason: "degraded",
    noAttemptReason: "degraded",
  });
});

test("experiment outcome captures no-attempt blocked metadata", () => {
  const outcome = resolveLessonWebllmExperimentOutcome({
    plan: {
      attemptLocalDispatch: false,
      fallbackReason: "blocked",
      noAttemptReason: "blocked",
    },
  });

  assert.deepEqual(outcome, {
    attemptState: "no_attempt",
    noAttemptReason: "blocked",
    fallbackReason: "blocked",
    successReason: null,
  });
});

test("contained dispatch plan fails closed when canonical asset plan is not ready", () => {
  const plan = resolveLessonWebllmContainedDispatchPlan({
    bootstrapReady: true,
    canonicalAssetReady: false,
    effectiveWebllmEnabled: true,
    wouldDispatchToWebllm: true,
    initialStatus: "READY",
    degradedRetryAllowed: true,
  });

  assert.deepEqual(plan, {
    attemptLocalDispatch: false,
    fallbackReason: "not_ready",
    noAttemptReason: "not_ready",
  });
});

test("experiment outcome captures attempted success metadata", () => {
  const outcome = resolveLessonWebllmExperimentOutcome({
    plan: {
      attemptLocalDispatch: true,
      fallbackReason: null,
      noAttemptReason: null,
    },
    localDispatchSucceeded: true,
  });

  assert.deepEqual(outcome, {
    attemptState: "attempted",
    noAttemptReason: null,
    fallbackReason: null,
    successReason: "local_dispatch_succeeded",
  });
});

test("experiment outcome captures attempted failure fallback reason", () => {
  const outcome = resolveLessonWebllmExperimentOutcome({
    plan: {
      attemptLocalDispatch: true,
      fallbackReason: null,
      noAttemptReason: null,
    },
    dispatchFailureReason: "timeout",
  });

  assert.deepEqual(outcome, {
    attemptState: "attempted",
    noAttemptReason: null,
    fallbackReason: "timeout",
    successReason: null,
  });
});

test("openai mainline fallback guard triggers on timeout/engine errors", () => {
  assert.equal(shouldFallbackToOpenAiMainline("timeout"), true);
  assert.equal(shouldFallbackToOpenAiMainline("engine_error"), true);
  assert.equal(shouldFallbackToOpenAiMainline("unsupported"), false);
});
