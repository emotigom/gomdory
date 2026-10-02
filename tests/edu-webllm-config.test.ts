import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_WEBLLM_KEYS,
  buildWebllmPaths,
  getWebllmCoachPaths,
  getWebllmClientEnvSnapshot,
  normalizeWebllmBaseUrl,
} from "@/lib/edu/llm/webllmConfig";

test("normalizeWebllmBaseUrl trims trailing slashes", () => {
  assert.equal(normalizeWebllmBaseUrl("https://models.gomdory.com/"), "https://models.gomdory.com");
  assert.equal(normalizeWebllmBaseUrl("https://models.gomdory.com///"), "https://models.gomdory.com");
});

test("buildWebllmPaths composes model and wasm URLs", () => {
  const result = buildWebllmPaths({
    modelId: "Qwen2-1.5B-Instruct-q4f16_1-MLC",
    modelBase: "https://models.gomdory.com/",
    libBase: "https://models.gomdory.com/libs/",
  });

  assert.equal(result.modelBase, "https://models.gomdory.com");
  assert.equal(result.libBase, "https://models.gomdory.com/libs");
  assert.equal(result.modelSubdir, "resolve/main");
  assert.equal(
    result.modelUrl,
    "https://models.gomdory.com/Qwen2-1.5B-Instruct-q4f16_1-MLC/resolve/main/",
  );
  assert.equal(
    result.wasmUrl,
    "https://models.gomdory.com/libs/Qwen2-1.5B-Instruct-q4f16_1-MLC/Qwen2-1.5B-Instruct-q4f16_1-MLC.wasm",
  );
});

test("buildWebllmPaths trims model subdir and avoids double slashes", () => {
  const result = buildWebllmPaths({
    modelId: "Qwen2-1.5B-Instruct-q4f16_1-MLC",
    modelBase: "https://models.gomdory.com/",
    libBase: "https://models.gomdory.com/libs/",
    modelSubdir: "/resolve/main/",
  });

  assert.equal(
    result.modelUrl,
    "https://models.gomdory.com/Qwen2-1.5B-Instruct-q4f16_1-MLC/resolve/main/",
  );
});

test("coach wasm filename composes resolved coach wasm URL", () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "Qwen2-1.5B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.gomdory.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.gomdory.com/libs";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_WASM_FILENAME =
    "Llama-3.2-1B-Instruct-q4f16_1-MLC/Llama-3.2-1B-Instruct-q4f16_1-MLC.wasm";

  const coach = getWebllmCoachPaths();
  assert.equal(
    coach?.wasmUrl,
    "https://models.gomdory.com/libs/Llama-3.2-1B-Instruct-q4f16_1-MLC/Llama-3.2-1B-Instruct-q4f16_1-MLC.wasm",
  );
});

test("required WebLLM key SSOT includes exact runtime-critical NEXT_PUBLIC set", () => {
  assert.deepEqual(REQUIRED_WEBLLM_KEYS, [
    "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
    "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID",
    "NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID",
    "NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE",
    "NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE",
  ]);
});

test("getWebllmClientEnvSnapshot reports set/unset without exposing values", () => {
  const original = Object.fromEntries(REQUIRED_WEBLLM_KEYS.map((key) => [key, process.env[key]]));
  const restore = () => {
    for (const [key, value] of Object.entries(original)) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  };
  restore();

  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "model-a";
  delete process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID;
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "coach-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.gomdory.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.gomdory.com/libs";

  const snapshot = getWebllmClientEnvSnapshot();
  assert.equal(snapshot.length, REQUIRED_WEBLLM_KEYS.length);
  assert.deepEqual(snapshot.find((entry) => entry.key === "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID"), {
    key: "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
    isSet: true,
    length: "model-a".length,
    source: "build",
  });
  assert.deepEqual(snapshot.find((entry) => entry.key === "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID"), {
    key: "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID",
    isSet: false,
    length: 0,
    source: "unset",
  });
  assert.deepEqual(snapshot.find((entry) => entry.key === "NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID"), {
    key: "NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID",
    isSet: true,
    length: "coach-model".length,
    source: "build",
  });

  const fallback = snapshot.find((entry) => entry.key === "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID");
  assert.equal(fallback?.length, 0);
  assert.equal(fallback?.source, "unset");

  restore();
});


test("getWebllmClientEnvSnapshot prefers runtime CLOUDFLARE env over build-time env", () => {
  const globalRef = globalThis as { __CLOUDFLARE_ENV__?: Record<string, string> };
  const prev = globalRef.__CLOUDFLARE_ENV__;
  globalRef.__CLOUDFLARE_ENV__ = {
    NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID: "runtime-model",
    NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID: "runtime-fallback",
    NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID: "runtime-coach",
    NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE: "https://runtime.models",
    NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE: "https://runtime.models/libs",
  };

  const snapshot = getWebllmClientEnvSnapshot();
  for (const entry of snapshot) {
    assert.equal(entry.source, "runtime");
    assert.equal(entry.length > 0, true);
  }

  globalRef.__CLOUDFLARE_ENV__ = prev;
});
