import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTemplateAbortUiReason,
  MIN_LOCAL_GENERATE_TIMEOUT_MS,
  resolveGenerateJsonTimeoutMs,
} from "@/lib/edu/llm/abortUtils";

test("resolveGenerateJsonTimeoutMs uses at least 60s for local webllm", () => {
  const timeout = resolveGenerateJsonTimeoutMs({
    usingLocalWebLLM: true,
    localTimeoutMs: 12_000,
    generatorTimeoutMs: 12_000,
  });
  assert.ok(timeout >= MIN_LOCAL_GENERATE_TIMEOUT_MS);
});

test("resolveGenerateJsonTimeoutMs keeps server timeout", () => {
  const timeout = resolveGenerateJsonTimeoutMs({
    usingLocalWebLLM: false,
    localTimeoutMs: 120_000,
    generatorTimeoutMs: 12_000,
  });
  assert.equal(timeout, 12_000);
});

test("classifyTemplateAbortUiReason maps timeout separately from user stop", () => {
  assert.equal(classifyTemplateAbortUiReason("timeout"), "timeout");
  assert.equal(classifyTemplateAbortUiReason("user_cancel"), "user");
  assert.equal(classifyTemplateAbortUiReason(undefined), "user");
});


test("resolveGenerateJsonTimeoutMs falls back for invalid local timeout", () => {
  const timeout = resolveGenerateJsonTimeoutMs({
    usingLocalWebLLM: true,
    localTimeoutMs: Number.NaN,
    generatorTimeoutMs: 12_000,
  });
  assert.equal(timeout, MIN_LOCAL_GENERATE_TIMEOUT_MS);
});

test("resolveGenerateJsonTimeoutMs falls back for invalid remote timeout", () => {
  const timeout = resolveGenerateJsonTimeoutMs({
    usingLocalWebLLM: false,
    localTimeoutMs: 120_000,
    generatorTimeoutMs: 0,
  });
  assert.equal(timeout, 12_000);
});
