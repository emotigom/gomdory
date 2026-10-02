import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { GET as webllmHealthGet } from "@/app/api/v1/edu/webllm/health/route";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
  mock.restoreAll();
});

test("webllm health preflight probes include If-None-Match for config/wasm", async () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "Qwen2-1.5B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";

  const optionHeaderValues: string[] = [];

  mock.method(globalThis, "fetch", async (input: URL | RequestInfo, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);

    if (method === "OPTIONS") {
      optionHeaderValues.push(headers.get("Access-Control-Request-Headers") ?? "");
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "https://www.gomdory.com",
          "access-control-allow-methods": "GET, HEAD, OPTIONS",
          "access-control-allow-headers": "Range, Content-Type, If-None-Match",
          "access-control-expose-headers": "Content-Length, ETag, Accept-Ranges",
          "cross-origin-resource-policy": "cross-origin",
        },
      });
    }

    const url = String(input);
    const isWasm = url.includes(".wasm");
    const status = isWasm && method === "GET" ? 206 : 200;
    return new Response("ok", {
      status,
      headers: {
        "accept-ranges": "bytes",
        etag: '"etag"',
        "access-control-allow-origin": "https://www.gomdory.com",
        "access-control-expose-headers": "Content-Length, ETag, Accept-Ranges",
        "cross-origin-resource-policy": "cross-origin",
      },
    });
  });

  const response = await webllmHealthGet(new Request("http://localhost/api/v1/edu/webllm/health"));
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.canonicalStatus, "WEBLLM_READY");
  assert.equal(payload.rolloutSnapshot?.operatorState, "ready_to_attempt");
  assert.equal(payload.rolloutSnapshot?.canonicalStatus, "WEBLLM_READY");
  assert.deepEqual(payload.runtimeModelOrder, [
    "Qwen2-1.5B-Instruct-q4f16_1-MLC",
    "Qwen2-0.5B-Instruct-q4f16_1-MLC",
  ]);
  assert.ok(payload.env?.source === "build" || payload.env?.source === "runtime" || payload.env?.source === "unset");
  assert.deepEqual(payload.env?.missingKeys, []);

  assert.ok(optionHeaderValues.length >= 5);
  assert.equal(optionHeaderValues[0], "Content-Type, If-None-Match");
  assert.equal(optionHeaderValues[1], "Range, Content-Type, If-None-Match");
  assert.equal(optionHeaderValues[2], "Content-Type, If-None-Match");
  assert.equal(optionHeaderValues[3], "Range, Content-Type, If-None-Match");
});


test("webllm health missing env는 source와 missingKeys를 함께 반환한다", async () => {
  delete process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID;
  delete process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID;
  delete process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID;
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";

  const response = await webllmHealthGet(new Request("http://localhost/api/v1/edu/webllm/health"));
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.rolloutSnapshot?.operatorState, "env_not_ready");
  assert.ok(payload.env?.source === "build" || payload.env?.source === "runtime" || payload.env?.source === "unset");
  assert.deepEqual(payload.missingKeys, [
    "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
    "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID",
    "NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID",
  ]);
  assert.deepEqual(payload.env?.missingKeys, payload.missingKeys);
});
