import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { GET as webllmHealthGet } from "@/app/api/v1/edu/webllm/health/route";
import { resolveWebllmCanonicalAssetPlan } from "@/lib/edu/llm/webllmCanonicalAssetPlan";
import { resolveHardDisable, resolveWebllmConfig } from "@/lib/edu/llm/webllmResolvedConfig";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
  mock.restoreAll();
});

test("resolveHardDisable follows strict truthy set", () => {
  assert.equal(resolveHardDisable(undefined), false);
  assert.equal(resolveHardDisable(""), false);
  assert.equal(resolveHardDisable("false"), false);
  assert.equal(resolveHardDisable("0"), false);
  assert.equal(resolveHardDisable("no"), false);
  assert.equal(resolveHardDisable("on"), false);
  assert.equal(resolveHardDisable("true"), true);
  assert.equal(resolveHardDisable("1"), true);
  assert.equal(resolveHardDisable("yes"), true);
});

test("health route exposes same resolved coach config snapshot", async () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "Qwen2-1.5B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_WASM_FILENAME =
    "Llama-3.2-1B-Instruct-q4f16_1-MLC/Llama-3.2-1B-Instruct-q4f16_1-MLC.wasm";
  process.env.EDU_WEBLLM_HARD_DISABLE = "0";

  mock.method(globalThis, "fetch", async () =>
    new Response("ok", {
      status: 200,
      headers: {
        "access-control-allow-origin": "https://www.gomdory.com",
      },
    }),
  );

  const resolved = resolveWebllmConfig();
  const response = await webllmHealthGet(new Request("http://localhost/api/v1/edu/webllm/health"));
  const payload = await response.json();

  assert.equal(payload.ok, true);
  assert.equal(payload.hardDisabled, resolved.hardDisable);
  assert.equal(payload.resolvedConfig.coachModelId, resolved.coach?.modelId ?? null);
  assert.equal(payload.resolvedConfig.coachWasmUrl, resolved.coach?.paths.wasmUrl ?? null);
  assert.equal(payload.resolvedConfig.modelBase, resolved.modelBase);
  assert.equal(payload.resolvedConfig.libBase, resolved.libBase);
  assert.deepEqual(payload.runtimeModelOrder, resolveWebllmCanonicalAssetPlan().runtimeModelOrder);
});

test("canonical asset plan classifies invalid derived urls without secrets", () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "primary-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "fallback-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "coach-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "not-a-url";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";

  const plan = resolveWebllmCanonicalAssetPlan();
  assert.equal(plan.statusCode, "WEBLLM_DERIVED_URL_INVALID");
  assert.ok(plan.invalidReasons.some((reason) => reason.includes("model_config_url_invalid")));
  assert.equal(JSON.stringify(plan).includes("SUPABASE_SERVICE_ROLE_KEY"), false);
});
