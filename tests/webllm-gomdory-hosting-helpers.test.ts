import test from "node:test";
import assert from "node:assert/strict";
import { classifyContentType, deriveModelArtifactUrls, hasAllowedCors, isAllowedGomdoryOrigin, missingRequiredFields } from "@/lib/webllm/gomdoryHostingCheckHelpers";

test("origin validation accepts only https models.gomdory.com", () => {
  assert.equal(isAllowedGomdoryOrigin("https://models.gomdory.com/a"), true);
  assert.equal(isAllowedGomdoryOrigin("http://models.gomdory.com/a"), false);
  assert.equal(isAllowedGomdoryOrigin("https://evil.com/a"), false);
});

test("artifact list generation includes required core files and qwen optional files", () => {
  const qwen = deriveModelArtifactUrls("https://models.gomdory.com/Qwen/resolve/main", "https://models.gomdory.com/libs/q.wasm", "Qwen2.5-Coder");
  assert.equal(qwen.some((a) => a.url.endsWith("/mlc-chat-config.json") && a.required), true);
  assert.equal(qwen.some((a) => a.url.endsWith("/vocab.json") && !a.required), true);
  const llama = deriveModelArtifactUrls("https://models.gomdory.com/Llama/resolve/main", "https://models.gomdory.com/libs/l.wasm", "Llama-3.2-1B");
  assert.equal(llama.some((a) => a.url.endsWith("/vocab.json")), false);
});

test("content-type classification", () => {
  assert.equal(classifyContentType("application/json; charset=utf-8"), "json");
  assert.equal(classifyContentType("application/wasm"), "wasm");
  assert.equal(classifyContentType("application/octet-stream"), "binary");
});

test("cors header validation", () => {
  assert.equal(hasAllowedCors("*"), true);
  assert.equal(hasAllowedCors("https://www.gomdory.com"), true);
  assert.equal(hasAllowedCors("https://evil.com"), false);
});

test("missing model_lib detected and disabled models can be filtered by callers", () => {
  assert.deepEqual(
    missingRequiredFields({ model_id: "x", model: "https://models.gomdory.com/x", parameterSizeLabel: "1B", quantization: "q4f16_1" }),
    ["model_lib"],
  );
});
