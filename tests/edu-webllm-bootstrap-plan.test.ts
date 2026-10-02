import assert from "node:assert/strict";
import test from "node:test";

import { EDU_FEATURE_FLAGS_DEFAULTS } from "@/lib/edu/featureFlags";
import { resolveWebllmBootstrapPlan } from "@/lib/edu/llm/webllmBootstrapPlan";


const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

const baseFlags = {
  ...EDU_FEATURE_FLAGS_DEFAULTS,
  webllmFeatureEnabled: true,
  webllmEnabled: true,
  webllmDownloadAllowed: true,
  reason: "allowlist",
};

test("hard-disable blocks local init and keeps fallback", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: baseFlags,
    hasRequiredEnv: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: true },
  });

  assert.equal(plan.hardDisabled, true);
  assert.equal(plan.shouldAttemptLocalInit, false);
  assert.equal(plan.shouldUseServerFallback, true);
  assert.equal(plan.reasonCategory, "hard_disabled");
  assert.equal(plan.statusCode, "WEBLLM_DISABLED");
});

test("download-blocked sample lesson blocks local init", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: { ...baseFlags, webllmDownloadAllowed: false },
    hasRequiredEnv: true,
    entryBlocked: true,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(plan.downloadAllowed, false);
  assert.equal(plan.shouldAttemptLocalInit, false);
  assert.equal(plan.reasonCategory, "entry_blocked");
});

test("missing env stays deterministic", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: baseFlags,
    hasRequiredEnv: false,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(plan.status, "ENV_MISSING");
  assert.equal(plan.statusCode, "WEBLLM_ENV_MISSING");
  assert.equal(plan.reasonCategory, "env_missing");
});

test("health hard-disabled blocks local init", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: baseFlags,
    hasRequiredEnv: true,
    entryBlocked: false,
    health: { ok: false, hardDisabled: true },
  });

  assert.equal(plan.healthHardDisabled, true);
  assert.equal(plan.shouldAttemptLocalInit, false);
  assert.equal(plan.shouldUseServerFallback, true);
});

test("join-token session carve-out keeps authRequired false", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: {
      ...baseFlags,
      reason: "join_token_session",
      reasons: ["join_token_session"],
      webllmEnabled: false,
      errorKind: "auth_error",
    },
    hasRequiredEnv: true,
    entryBlocked: true,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(plan.joinTokenSessionAllowed, true);
  assert.equal(plan.authRequired, false);
});

test("degraded gate blocks init consistently", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: baseFlags,
    hasRequiredEnv: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
    degradedBlocked: true,
  });

  assert.equal(plan.degradedBlocked, true);
  assert.equal(plan.status, "DEGRADED");
  assert.equal(plan.shouldAttemptLocalInit, false);
});

test("chatpanel-facing disabled status mapping remains stable", () => {
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: { ...baseFlags, webllmEnabled: false, errorKind: "auth_error", reason: "unauthorized" },
    hasRequiredEnv: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(plan.status, "DISABLED");
  assert.equal(plan.statusCode, "WEBLLM_DISABLED");
});

test("debug snapshot excludes secret values", () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "SENSITIVE_MODEL_ID_SHOULD_NOT_APPEAR";
  const plan = resolveWebllmBootstrapPlan({
    featureFlags: baseFlags,
    hasRequiredEnv: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
  });

  const snapshotText = JSON.stringify(plan.debugSnapshot);
  assert.equal(snapshotText.includes("SENSITIVE_MODEL_ID_SHOULD_NOT_APPEAR"), false);
});
