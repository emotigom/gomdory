import test from "node:test";
import assert from "node:assert/strict";
import { isWebLLMLabEnabled, isWebLLMModelSmokeEnabled } from "@/lib/webllm/webllmFlags";

test("model smoke requires both flags", () => {
  delete process.env.NEXT_PUBLIC_WEBLLM_LAB_V1;
  process.env.NEXT_PUBLIC_WEBLLM_MODEL_SMOKE_V1 = "1";
  assert.equal(isWebLLMLabEnabled(), false);
  assert.equal(isWebLLMModelSmokeEnabled(), false);
  process.env.NEXT_PUBLIC_WEBLLM_LAB_V1 = "1";
  assert.equal(isWebLLMModelSmokeEnabled(), true);
});
