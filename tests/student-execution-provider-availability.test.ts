import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { resolveStudentProviderAvailability } from "@/lib/edu/lesson/studentExecutionProviderAvailability";

const chatPanelSource = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");

test("provider availability keeps openai-first path observable while preserving optional webllm", () => {
  const availability = resolveStudentProviderAvailability({
    openaiConfigured: true,
    openaiProxyReachable: true,
    webllmAvailable: true,
    bypassRequested: false,
    webllmUnavailableReason: null,
  });

  assert.equal(availability.openaiConfigured, true);
  assert.equal(availability.openaiProxyReachable, true);
  assert.equal(availability.openaiUsable, true);
  assert.equal(availability.webllmAvailable, true);
  assert.equal(availability.webllmUsable, true);
  assert.equal(availability.fallbackAvailable, true);
  assert.deepEqual(availability.reasonCodes, []);
});

test("chat panel resolves provider readiness through the dedicated execution-boundary helper", () => {
  assert.equal(chatPanelSource.includes("resolveStudentProviderAvailability"), true);
  assert.equal(
    chatPanelSource.includes("@/lib/edu/lesson/studentExecutionProviderAvailability"),
    true,
  );
});

test("webllm env missing is surfaced as explicit skip reason", () => {
  const availability = resolveStudentProviderAvailability({
    openaiConfigured: true,
    openaiProxyReachable: true,
    webllmAvailable: false,
    bypassRequested: false,
    webllmUnavailableReason: "env_missing",
  });

  assert.equal(availability.openaiUsable, true);
  assert.equal(availability.webllmAvailable, false);
  assert.equal(availability.webllmUsable, false);
  assert.equal(availability.reasonCodes.includes("webllm_env_missing"), true);
});

test("openai proxy unreachable and webllm bypass both stay observable", () => {
  const availability = resolveStudentProviderAvailability({
    openaiConfigured: true,
    openaiProxyReachable: false,
    webllmAvailable: true,
    bypassRequested: true,
    webllmUnavailableReason: null,
  });

  assert.equal(availability.openaiUsable, false);
  assert.equal(availability.reasonCodes.includes("openai_proxy_unreachable"), true);
  assert.equal(availability.webllmUsable, false);
  assert.equal(availability.reasonCodes.includes("webllm_bypassed"), true);
});

test("loading-too-long is treated as immediate webllm skip reason", () => {
  const availability = resolveStudentProviderAvailability({
    openaiConfigured: true,
    openaiProxyReachable: true,
    webllmAvailable: false,
    bypassRequested: false,
    webllmUnavailableReason: "loading_too_long",
  });

  assert.equal(availability.webllmUsable, false);
  assert.equal(availability.reasonCodes.includes("webllm_loading_too_long"), true);
});

test("disabled and unavailable reasons are surfaced for deterministic fallback handoff", () => {
  const disabled = resolveStudentProviderAvailability({
    openaiConfigured: true,
    openaiProxyReachable: true,
    webllmAvailable: false,
    bypassRequested: false,
    webllmUnavailableReason: "disabled",
  });
  const unavailable = resolveStudentProviderAvailability({
    openaiConfigured: true,
    openaiProxyReachable: true,
    webllmAvailable: false,
    bypassRequested: false,
    webllmUnavailableReason: "unavailable",
  });

  assert.equal(disabled.reasonCodes.includes("webllm_disabled"), true);
  assert.equal(unavailable.reasonCodes.includes("webllm_unavailable"), true);
});
