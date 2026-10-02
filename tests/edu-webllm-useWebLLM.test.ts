import assert from "node:assert/strict";
import test from "node:test";

import { resolveWebllmModelId } from "@/lib/edu/llm/useWebLLM";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("legacy NEXT_PUBLIC_WEBLLM_MODEL_ID does not override EDU model id", () => {
  delete process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID;
  process.env.NEXT_PUBLIC_WEBLLM_MODEL_ID = "legacy-model";
  assert.equal(resolveWebllmModelId(), "");

  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "edu-model";
  assert.equal(resolveWebllmModelId(), "edu-model");
});
