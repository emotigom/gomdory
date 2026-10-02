import assert from "node:assert/strict";
import test from "node:test";

import { EDU_FEATURE_FLAGS_DEFAULTS } from "@/lib/edu/featureFlags";
import {
  resolveLessonWebllmLaneBoundary,
  resolveLessonWebllmLaneStatusView,
  resolveLessonWebllmReadinessSnapshot,
} from "@/lib/edu/lesson/lessonWebllmLaneDescriptor";

const baseFlags = { ...EDU_FEATURE_FLAGS_DEFAULTS, reason: "default" };

test("readiness snapshot composes gate/descriptor in disabled lane without asset resolution", () => {
  const snapshot = resolveLessonWebllmReadinessSnapshot({
    featureFlags: { ...baseFlags, webllmFeatureEnabled: false, webllmEnabled: false },
    hasWebllmEnv: true,
    entryBlocked: false,
    health: null,
    preferredModelId: null,
  });

  assert.equal(snapshot.gate.effectiveWebllmEnabled, false);
  assert.equal(snapshot.gate.webllmSsotDisabled, true);
  assert.deepEqual(snapshot.descriptor.hosts, { modelHost: null, wasmHost: null });
  assert.equal(snapshot.descriptor.selection.fallbackModelId, null);
});

test("readiness snapshot keeps health-based host fallback behavior", () => {
  const snapshot = resolveLessonWebllmReadinessSnapshot({
    featureFlags: baseFlags,
    hasWebllmEnv: false,
    entryBlocked: false,
    health: {
      ok: true,
      hardDisabled: false,
      primary: {
        modelConfigUrl: "https://models.gomdory.com/model/resolve/main/mlc-chat-config.json",
        selectedWasmUrl: "https://libs.gomdory.com/model/webllm.wasm",
      },
      coach: { modelId: "coach-a" },
    },
    preferredModelId: "not-configured-model",
  });

  assert.equal(snapshot.gate.effectiveWebllmEnabled, true);
  assert.deepEqual(snapshot.descriptor.hosts, {
    modelHost: "models.gomdory.com",
    wasmHost: "libs.gomdory.com",
  });
  assert.equal(snapshot.descriptor.selection.coachModelId, "coach-a");
});

test("lane boundary adapter preserves decorate boundary semantics", () => {
  const result = resolveLessonWebllmLaneBoundary({
    decorateQuotaExceeded: false,
    webllmStatusCode: "WEBLLM_LOADING",
    webllmStatusAt: 1_000,
    effectiveStatus: "LOADING",
    effectiveWebllmEnabled: true,
    hasModelHost: true,
    hasWasmHost: true,
    readyWaitMs: 5_000,
    nowMs: 10_000,
  });

  assert.deepEqual(result.bypassDecision, { bypass: true, reason: "SLOW_INIT" });
  assert.equal(result.webllmUnavailableReason, "loading_too_long");
  assert.equal(result.bypassTelemetry.decision, true);
});


test("lane status view normalizes disabled reasons and guide", () => {
  const readiness = resolveLessonWebllmReadinessSnapshot({
    featureFlags: { ...baseFlags, reason: "unauthorized" },
    hasWebllmEnv: true,
    entryBlocked: false,
    health: null,
    preferredModelId: "model-a",
  });

  const statusView = resolveLessonWebllmLaneStatusView({
    readiness,
    webllmEntryBlocked: false,
    preferredModelId: "model-a",
  });

  assert.equal(statusView.readinessState, "disabled");
  assert.equal(statusView.disabledReason, "auth_required");
  assert.equal(statusView.selection.preferredModelId, "model-a");
  assert.match(statusView.unavailableGuide ?? "", /로그인\/세션이 필요합니다/);
});

test("lane status view keeps hold state for missing env while enabled", () => {
  const readiness = resolveLessonWebllmReadinessSnapshot({
    featureFlags: baseFlags,
    hasWebllmEnv: false,
    entryBlocked: false,
    health: null,
    preferredModelId: null,
  });

  const statusView = resolveLessonWebllmLaneStatusView({
    readiness,
    webllmEntryBlocked: false,
    preferredModelId: null,
  });

  assert.equal(statusView.readinessState, "hold");
  assert.equal(statusView.holdReason, "env_missing");
  assert.equal(statusView.unavailableGuide, null);
});
