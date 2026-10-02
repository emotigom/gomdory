import assert from "node:assert/strict";
import test from "node:test";

import { EDU_FEATURE_FLAGS_DEFAULTS } from "@/lib/edu/featureFlags";
import { resolveWebllmClientGate } from "@/lib/edu/llm/webllmClientGate";

test("webllm client gate allows init for join_token_session even when errorKind is auth_error", () => {
  const gate = resolveWebllmClientGate({
    featureFlags: {
      ...EDU_FEATURE_FLAGS_DEFAULTS,
      reason: "join_token_session",
      reasons: ["join_token_session"],
      webllmEnabled: true,
      webllmDownloadAllowed: true,
      errorKind: "auth_error",
      gatingMode: "join_token",
    },
    baseEnabled: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(gate.effectiveEnabled, true);
  assert.equal(gate.authRequired, false);
  assert.equal(gate.downloadAllowed, true);
  assert.equal(gate.disabled, false);
});

test("webllm client gate marks auth required only when webllm disabled by flags", () => {
  const gate = resolveWebllmClientGate({
    featureFlags: {
      ...EDU_FEATURE_FLAGS_DEFAULTS,
      reason: "unauthorized",
      webllmEnabled: false,
      webllmDownloadAllowed: true,
      errorKind: "auth_error",
      gatingMode: "user_only",
    },
    baseEnabled: false,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(gate.effectiveEnabled, false);
  assert.equal(gate.authRequired, true);
  assert.equal(gate.disabled, true);
});

test("webllm client gate disables when health check hard-disabled", () => {
  const gate = resolveWebllmClientGate({
    featureFlags: {
      ...EDU_FEATURE_FLAGS_DEFAULTS,
      webllmEnabled: true,
      webllmDownloadAllowed: true,
    },
    baseEnabled: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: true },
  });

  assert.equal(gate.effectiveEnabled, false);
  assert.equal(gate.disabled, true);
});


test("webllm client gate keeps enabled when entry is blocked but flags+health are healthy", () => {
  const gate = resolveWebllmClientGate({
    featureFlags: {
      ...EDU_FEATURE_FLAGS_DEFAULTS,
      webllmFeatureEnabled: true,
      webllmEnabled: true,
      webllmDownloadAllowed: true,
    },
    baseEnabled: true,
    entryBlocked: true,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(gate.disabled, false);
  assert.equal(gate.effectiveEnabled, true);
  assert.equal(gate.downloadAllowed, true);
});

test("webllm client gate disables when feature flag download disallowed", () => {
  const gate = resolveWebllmClientGate({
    featureFlags: {
      ...EDU_FEATURE_FLAGS_DEFAULTS,
      webllmFeatureEnabled: true,
      webllmEnabled: true,
      webllmDownloadAllowed: false,
    },
    baseEnabled: true,
    entryBlocked: false,
    health: { ok: true, hardDisabled: false },
  });

  assert.equal(gate.disabled, true);
  assert.equal(gate.effectiveEnabled, false);
});
