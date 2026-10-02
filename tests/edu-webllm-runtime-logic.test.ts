import assert from "node:assert/strict";
import test from "node:test";

import { resolveWebllmDownloadPolicyFromRequest } from "@/lib/edu/llm/webllmAccessPolicy";
import { createWebllmAssetResolver } from "@/lib/edu/llm/webllmAssetResolver";
import { resolveWebllmCanonicalAssetPlan } from "@/lib/edu/llm/webllmCanonicalAssetPlan";
import { getWebLLMDeviceTier } from "@/lib/edu/llm/webllmTiering";

test("asset resolver builds config + wasm urls from env", () => {
  const resolver = createWebllmAssetResolver({
    modelBase: "https://models.gomdory.com/",
    libBase: "https://models.gomdory.com/libs/",
    modelSubdir: "/resolve/main/",
  });

  assert.equal(
    resolver.modelConfigUrl("Qwen2.5-1.5B-Instruct-q4f16_1-MLC"),
    "https://models.gomdory.com/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json",
  );
  assert.deepEqual(resolver.wasmCandidates("Qwen2.5-1.5B-Instruct-q4f16_1-MLC"), [
    "https://models.gomdory.com/libs/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/Qwen2.5-1.5B-Instruct-q4f16_1-MLC.wasm",
    "https://models.gomdory.com/libs/webllm-model.wasm",
  ]);
});

test("tiering chooses lite tier for low-end devices and fast tier only with isolation+threads", () => {
  const lowMemory = getWebLLMDeviceTier({ deviceMemory: 4, hardwareConcurrency: 8 });
  assert.equal(lowMemory.selectedTier, "lite");
  assert.equal(lowMemory.preferFallback, true);

  const lowCpu = getWebLLMDeviceTier({ deviceMemory: 8, hardwareConcurrency: 4 });
  assert.equal(lowCpu.selectedTier, "lite");
  assert.equal(lowCpu.preferFallback, true);

  const fast = getWebLLMDeviceTier({
    deviceMemory: 8,
    hardwareConcurrency: 8,
    crossOriginIsolated: true,
    sharedArrayBuffer: true,
    wasmThreadsSupported: true,
  });
  assert.equal(fast.selectedTier, "fast");
  assert.equal(fast.preferFallback, false);

  const normal = getWebLLMDeviceTier({
    deviceMemory: 8,
    hardwareConcurrency: 8,
    crossOriginIsolated: false,
    sharedArrayBuffer: false,
    wasmThreadsSupported: false,
  });
  assert.equal(normal.selectedTier, "normal");
  assert.equal(normal.preferFallback, false);

  const cooldown = getWebLLMDeviceTier({
    deviceMemory: 16,
    hardwareConcurrency: 12,
    cooldownActive: true,
  });
  assert.equal(cooldown.selectedTier, "lite");
  assert.equal(cooldown.cooldownActive, true);
});

test("runtime gating can be verified through canonical request policy resolver", () => {
  const blockedSampleRequest = new Request("https://www.gomdory.com/api/v1/edu/feature-flags", {
    headers: {
      referer: "https://www.gomdory.com/edu/lesson/1",
    },
  });
  const allowedSampleWithJoinTokenRequest = new Request(
    "https://www.gomdory.com/api/v1/edu/feature-flags",
    {
      headers: {
        referer: "https://www.gomdory.com/edu/lesson/1",
        cookie: "__Host-edu_jt=valid_join_token_1234",
      },
    },
  );

  assert.equal(resolveWebllmDownloadPolicyFromRequest(blockedSampleRequest).downloadAllowed, false);
  assert.equal(
    resolveWebllmDownloadPolicyFromRequest(allowedSampleWithJoinTokenRequest).downloadAllowed,
    true,
  );
});

test("canonical plan keeps primary/fallback runtime order stable", () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "primary-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "fallback-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "coach-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";

  const plan = resolveWebllmCanonicalAssetPlan();
  assert.deepEqual(plan.runtimeModelOrder, ["primary-model", "fallback-model"]);
  assert.equal(plan.primary?.modelConfigUrl.endsWith("/mlc-chat-config.json"), true);
});
