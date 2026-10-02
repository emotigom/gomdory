import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLessonWebllmDecorateBoundary,
  resolveLessonWebllmErrorStatus,
} from "@/lib/edu/lesson/lessonWebllmExecutionAdapter";

const baseInput = {
  decorateQuotaExceeded: false,
  webllmStatusCode: null,
  webllmStatusAt: null,
  effectiveStatus: "READY" as const,
  effectiveWebllmEnabled: true,
  hasModelHost: true,
  hasWasmHost: true,
  readyWaitMs: 10_000,
  nowMs: 20_000,
};

test("decorate boundary preserves strict bypass precedence and telemetry payload values", () => {
  const quotaExceeded = resolveLessonWebllmDecorateBoundary({
    ...baseInput,
    decorateQuotaExceeded: true,
    webllmStatusCode: "WEBLLM_HEALTH_FALLBACK",
    effectiveStatus: "ENV_MISSING",
  });

  assert.deepEqual(quotaExceeded.bypassDecision, { bypass: true, reason: "QUOTA_EXCEEDED" });
  assert.deepEqual(quotaExceeded.bypassTelemetry, {
    webllmStatus: "ENV_MISSING",
    webllmCode: "WEBLLM_HEALTH_FALLBACK",
    isLoadingTooLong: false,
    sawQuotaExceeded: true,
    decision: true,
  });

  const healthFallback = resolveLessonWebllmDecorateBoundary({
    ...baseInput,
    webllmStatusCode: "WEBLLM_HEALTH_FALLBACK",
  });
  assert.deepEqual(healthFallback.bypassDecision, { bypass: true, reason: "HEALTH_FALLBACK" });

  const envMissing = resolveLessonWebllmDecorateBoundary({
    ...baseInput,
    effectiveStatus: "ENV_MISSING",
  });
  assert.deepEqual(envMissing.bypassDecision, { bypass: true, reason: "ENV_MISSING" });
});

test("decorate boundary preserves loading timeout and strict-ready checks", () => {
  const loadingTooLong = resolveLessonWebllmDecorateBoundary({
    ...baseInput,
    effectiveStatus: "LOADING",
    webllmStatusAt: 0,
    nowMs: 15_000,
    readyWaitMs: 5_000,
  });
  assert.equal(loadingTooLong.isLoadingTooLong, false, "statusAt=0 stays falsy by design");

  const loadingTooLongWithTimestamp = resolveLessonWebllmDecorateBoundary({
    ...baseInput,
    effectiveStatus: "LOADING",
    webllmStatusAt: 1_000,
    nowMs: 15_000,
    readyWaitMs: 5_000,
  });
  assert.equal(loadingTooLongWithTimestamp.isLoadingTooLong, true);
  assert.deepEqual(loadingTooLongWithTimestamp.bypassDecision, { bypass: true, reason: "SLOW_INIT" });

  const notReadyStrict = resolveLessonWebllmDecorateBoundary({
    ...baseInput,
    webllmStatusCode: "WEBLLM_LOADING",
    effectiveStatus: "READY",
  });
  assert.deepEqual(notReadyStrict.bypassDecision, { bypass: true, reason: "NOT_READY_STRICT" });

  const strictReady = resolveLessonWebllmDecorateBoundary(baseInput);
  assert.deepEqual(strictReady.bypassDecision, { bypass: false, reason: null });
});

test("decorate boundary preserves unavailable reason mapping", () => {
  assert.equal(
    resolveLessonWebllmDecorateBoundary({ ...baseInput, effectiveStatus: "ENV_MISSING" }).webllmUnavailableReason,
    "env_missing",
  );
  assert.equal(
    resolveLessonWebllmDecorateBoundary({ ...baseInput, effectiveStatus: "DISABLED" }).webllmUnavailableReason,
    "disabled",
  );
  assert.equal(
    resolveLessonWebllmDecorateBoundary({ ...baseInput, effectiveStatus: "UNSUPPORTED" }).webllmUnavailableReason,
    "unavailable",
  );
  assert.equal(
    resolveLessonWebllmDecorateBoundary({
      ...baseInput,
      effectiveStatus: "LOADING",
      webllmStatusAt: 1_000,
      nowMs: 15_000,
      readyWaitMs: 5_000,
    }).webllmUnavailableReason,
    "loading_too_long",
  );
  assert.equal(resolveLessonWebllmDecorateBoundary(baseInput).webllmUnavailableReason, null);
});

test("error status mapping is preserved", () => {
  assert.equal(
    resolveLessonWebllmErrorStatus({ errorCode: "EDU_WEBLLM_ENV_MISSING", hasWebllmEnvEffective: false }),
    "ENV_MISSING",
  );
  assert.equal(
    resolveLessonWebllmErrorStatus({ errorCode: "EDU_WEBLLM_ENV_MISSING", hasWebllmEnvEffective: true }),
    "ERROR",
  );
  assert.equal(resolveLessonWebllmErrorStatus({ errorCode: "EDU_WEBLLM_MODEL_ID_UNKNOWN", hasWebllmEnvEffective: true }), "MODEL_ID_UNKNOWN");
  assert.equal(resolveLessonWebllmErrorStatus({ errorCode: "EDU_WEBLLM_CORS_BLOCKED", hasWebllmEnvEffective: true }), "CORS_BLOCKED");
  assert.equal(
    resolveLessonWebllmErrorStatus({ errorCode: "EDU_WEBLLM_PREFLIGHT_MODEL_FAILED", hasWebllmEnvEffective: true }),
    "ASSET_UNREACHABLE",
  );
  assert.equal(resolveLessonWebllmErrorStatus({ errorCode: "EDU_WEBLLM_UNSUPPORTED", hasWebllmEnvEffective: true }), "UNSUPPORTED");
  assert.equal(resolveLessonWebllmErrorStatus({ errorCode: "WEBLLM_DOWNLOAD_BLOCKED", hasWebllmEnvEffective: true }), "DISABLED");
  assert.equal(resolveLessonWebllmErrorStatus({ reason: "timeout", hasWebllmEnvEffective: true }), "ERROR");
});
