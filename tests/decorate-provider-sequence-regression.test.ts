import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("app/edu/_components/ChatPanel.tsx", "utf8");

test("webllm skip no longer directly triggers fallback_start", () => {
  const snippet = /if \(!providerAvailability\.webllmUsable\) \{[\s\S]*?\}/.exec(source)?.[0] ?? "";
  assert.equal(snippet.includes("decorate_webllm_skipped"), true);
  assert.equal(snippet.includes("decorate_fallback_start"), false);
});

test("openai attempt still emits started before failure fallback", () => {
  const openaiAt = source.indexOf('type: "decorate_openai_attempt_started"');
  const fallbackAt = source.indexOf('type: "decorate_fallback_start"');
  assert.equal(openaiAt > -1, true);
  assert.equal(fallbackAt > openaiAt, true);
});

test("llm bypass is interpreted as local webllm skip only", () => {
  assert.equal(source.includes('interpretation: "local_webllm_skip_only"'), true);
});
