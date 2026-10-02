import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { GET as assetValidatorGet } from "@/app/api/v1/edu/webllm/asset-validator/route";
import { GET as healthGet } from "@/app/api/v1/edu/webllm/health/route";
import { resolveWebllmCanonicalAssetPlan } from "@/lib/edu/llm/webllmCanonicalAssetPlan";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
  mock.restoreAll();
});

test("canonical plan, health, and validator share the same primary asset family", async () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "primary-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "fallback-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "coach-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";

  mock.method(globalThis, "fetch", async (input: URL | RequestInfo, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const url = String(input);
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "https://www.gomdory.com",
          "access-control-allow-methods": "GET, HEAD, OPTIONS",
          "access-control-allow-headers": "Range, Content-Type, If-None-Match",
          "access-control-expose-headers": "Content-Length, ETag, Accept-Ranges",
        },
      });
    }
    if (url.includes(".wasm") && method === "GET") {
      return new Response("ok", { status: 206, headers: { "accept-ranges": "bytes", "access-control-allow-origin": "https://www.gomdory.com" } });
    }
    return new Response("ok", {
      status: 200,
      headers: {
        "accept-ranges": "bytes",
        "access-control-allow-origin": "https://www.gomdory.com",
      },
    });
  });

  const plan = resolveWebllmCanonicalAssetPlan();
  assert.equal(plan.statusCode, "WEBLLM_READY");

  const healthResponse = await healthGet(new Request("http://localhost/api/v1/edu/webllm/health"));
  const healthBody = await healthResponse.json();
  const validatorResponse = await assetValidatorGet(new Request("http://localhost/api/v1/edu/webllm/asset-validator"));
  const validatorBody = await validatorResponse.json();

  assert.equal(healthBody.primary.modelConfigUrl, plan.primary?.modelConfigUrl);
  assert.deepEqual(healthBody.primary.wasmCandidateUrls, plan.primary?.wasmCandidateUrls);
  assert.equal(validatorBody.primary.modelId, plan.primary?.modelId);
  assert.equal(validatorBody.primary.configHead.url, plan.primary?.modelConfigUrl);
  assert.equal(validatorBody.primary.wasmHead.url, plan.primary?.selectedWasmUrl);
});

