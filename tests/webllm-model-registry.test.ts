import assert from "node:assert/strict";
import test from "node:test";

import {
  WEBLLM_KNOWN_MODEL_IDS,
  WEBLLM_MODEL_ASSET_ROOT,
  WEBLLM_MODEL_BASE_URL,
  WEBLLM_MODEL_FOLDERS,
  buildWebLLMModelArtifactUrl,
  buildWebLLMModelLibUrl,
  listWebLLMDisabledModels,
  listWebLLMLoadableModels,
  listWebLLMProvisionalModels,
  resolveWebLLMModelRecord,
  validateWebLLMModelRegistry,
} from "@/lib/edu/llm/webllmModelRegistry";

test("webllm registry pins base and asset root", () => {
  assert.equal(WEBLLM_MODEL_BASE_URL, "https://models.gomdory.com");
  assert.equal(WEBLLM_MODEL_ASSET_ROOT, "edu-webllm-models");
  assert.deepEqual(WEBLLM_KNOWN_MODEL_IDS, WEBLLM_MODEL_FOLDERS);
});

test("webllm registry builds deterministic artifact and lib URLs", () => {
  for (const modelId of WEBLLM_MODEL_FOLDERS) {
    const modelUrl = buildWebLLMModelArtifactUrl(modelId);
    assert.equal(modelUrl, `https://models.gomdory.com/edu-webllm-models/${modelId}/resolve/main/`);
    if (modelId !== "Qwen2-1.5B-Instruct-q4f16_1-MLC") {
      assert.equal(
        buildWebLLMModelLibUrl(modelId),
        `https://models.gomdory.com/edu-webllm-models/libs/${modelId}/${modelId}.wasm`,
      );
    }
  }
});

test("all observed model ids are represented and resolved safely", () => {
  assert.equal(WEBLLM_MODEL_FOLDERS.length, 4);
  for (const modelId of WEBLLM_MODEL_FOLDERS) {
    const record = resolveWebLLMModelRecord(modelId);
    assert.ok(record);
    assert.equal(record?.modelId, modelId);
  }
  assert.equal(resolveWebLLMModelRecord("unknown-model"), null);
});

test("qwen2-1.5b is present but not runtime loadable due to missing wasm", () => {
  const record = resolveWebLLMModelRecord("Qwen2-1.5B-Instruct-q4f16_1-MLC");
  assert.ok(record);
  assert.equal(record?.runtimeLoadable, false);
  assert.equal(record?.runtimeStatus, "missing_model_lib");
  assert.equal(record?.modelLibUrl, null);
  assert.match(record?.disabledReason ?? "", /does not include a matching WebGPU wasm model_lib/);
});

test("qwen2.5-coder-0.5b is the recommended coding default candidate", () => {
  const record = resolveWebLLMModelRecord("Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC");
  assert.ok(record);
  assert.equal(record?.purpose, "coding");
  assert.equal(record?.recommendedDefault, true);
  assert.equal(record?.runtimeLoadable, true);
});

test("loadable/provisional/disabled list helpers return expected models", () => {
  const loadable = listWebLLMLoadableModels().map((record) => record.modelId);
  assert.deepEqual(loadable, [
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
    "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
  ]);

  const provisional = listWebLLMProvisionalModels().map((record) => record.modelId);
  assert.deepEqual(provisional, [
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
  ]);

  const disabled = listWebLLMDisabledModels().map((record) => record.modelId);
  assert.deepEqual(disabled, ["Qwen2-1.5B-Instruct-q4f16_1-MLC"]);
});

test("registry validation returns warnings instead of throwing", () => {
  const result = validateWebLLMModelRegistry();
  assert.equal(result.records.length, WEBLLM_MODEL_FOLDERS.length);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.warnings.some((warning) => warning.includes("provisional")));
  assert.ok(result.warnings.some((warning) => warning.includes("Qwen2-1.5B-Instruct-q4f16_1-MLC")));
});
