import assert from "node:assert/strict";
import test from "node:test";

import { EDU_FEATURE_FLAGS_DEFAULTS } from "@/lib/edu/featureFlags";
import { resolveLessonWebllmActivationPreflight } from "@/lib/edu/lesson/lessonWebllmActivationPreflight";
import { resolveLessonWebllmReadinessSnapshot } from "@/lib/edu/lesson/lessonWebllmLaneDescriptor";

const baseFlags = { ...EDU_FEATURE_FLAGS_DEFAULTS, reason: "default" };

test("activation preflight is eligible for ready lane with required metadata", () => {
  const readiness = resolveLessonWebllmReadinessSnapshot({
    featureFlags: { ...baseFlags, webllmFeatureEnabled: true, webllmEnabled: true },
    hasWebllmEnv: true,
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
    preferredModelId: "missing-model",
  });

  const preflight = resolveLessonWebllmActivationPreflight({
    readiness,
    webllmEntryBlocked: false,
    preferredModelId: "missing-model",
  });

  assert.equal(preflight.eligibility, "eligible");
  assert.deepEqual(preflight.hardBlockers, []);
  assert.equal(preflight.requiredConditions.hasModelSelectionMetadata, true);
});

test("activation preflight classifies auth-required disabled lane as hard blocker", () => {
  const readiness = resolveLessonWebllmReadinessSnapshot({
    featureFlags: { ...baseFlags, reason: "unauthorized", webllmFeatureEnabled: false },
    hasWebllmEnv: true,
    entryBlocked: false,
    health: null,
    preferredModelId: "model-a",
  });

  const preflight = resolveLessonWebllmActivationPreflight({
    readiness,
    webllmEntryBlocked: false,
    preferredModelId: "model-a",
  });

  assert.equal(preflight.eligibility, "ineligible");
  assert.deepEqual(preflight.hardBlockers, ["auth_required", "ssot_disabled"]);
});

test("activation preflight classifies hold lane as env blocker", () => {
  const readiness = resolveLessonWebllmReadinessSnapshot({
    featureFlags: { ...baseFlags, webllmFeatureEnabled: true, webllmEnabled: true },
    hasWebllmEnv: false,
    entryBlocked: false,
    health: null,
    preferredModelId: "model-a",
  });

  const preflight = resolveLessonWebllmActivationPreflight({
    readiness,
    webllmEntryBlocked: false,
    preferredModelId: "model-a",
  });

  assert.equal(preflight.eligibility, "ineligible");
  assert.deepEqual(preflight.hardBlockers, ["env_missing"]);
});

test("activation preflight reports model metadata blocker when selection metadata is missing", () => {
  const readiness = resolveLessonWebllmReadinessSnapshot({
    featureFlags: { ...baseFlags, webllmFeatureEnabled: true, webllmEnabled: true },
    hasWebllmEnv: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false, primary: null, coach: { modelId: "" } },
    preferredModelId: null,
  });

  const preflight = resolveLessonWebllmActivationPreflight({
    readiness,
    webllmEntryBlocked: false,
    preferredModelId: null,
  });

  assert.equal(preflight.eligibility, "ineligible");
  assert.ok(preflight.hardBlockers.includes("model_metadata_missing"));
  assert.equal(preflight.requiredConditions.hasModelSelectionMetadata, false);
});
