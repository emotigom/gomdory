import test from "node:test";
import assert from "node:assert/strict";
import { isWebLLMGomdoryModelsEnabled, isWebLLMModelSmokeEnabled } from "@/lib/webllm/webllmFlags";
import { selectGomdorySmokeModel } from "@/lib/webllm/webllmGomdoryModelManifest";

test("gomdory flag default false and requires lab+smoke", () => {
  delete process.env.NEXT_PUBLIC_WEBLLM_GOMDORY_MODELS_V1;
  delete process.env.NEXT_PUBLIC_WEBLLM_LAB_V1;
  delete process.env.NEXT_PUBLIC_WEBLLM_MODEL_SMOKE_V1;
  assert.equal(isWebLLMGomdoryModelsEnabled(), false);
  process.env.NEXT_PUBLIC_WEBLLM_GOMDORY_MODELS_V1 = "1";
  assert.equal(isWebLLMGomdoryModelsEnabled(), false);
  process.env.NEXT_PUBLIC_WEBLLM_LAB_V1 = "1";
  process.env.NEXT_PUBLIC_WEBLLM_MODEL_SMOKE_V1 = "1";
  assert.equal(isWebLLMModelSmokeEnabled(), true);
  assert.equal(isWebLLMGomdoryModelsEnabled(), true);
});

test("recommended small model preferred", () => {
  const m = selectGomdorySmokeModel([
    { model_id: "model-3B-chat", model: "https://models.gomdory.com/a", model_lib: "https://models.gomdory.com/b" },
    { model_id: "model-1B-instruct", recommendedForSmoke: true, model: "https://models.gomdory.com/c", model_lib: "https://models.gomdory.com/d" },
  ]);
  assert.equal(m?.model_id, "model-1B-instruct");
});
