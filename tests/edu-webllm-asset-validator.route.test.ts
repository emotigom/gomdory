import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { NextRequest } from "next/server";

import { GET as assetValidatorGet } from "@/app/api/v1/edu/webllm/asset-validator/route";

const originalEnv = { ...process.env };

const makeJsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });

const makeBinaryResponse = (status: number, headers: Record<string, string> = {}) =>
  new Response("0", {
    status,
    headers,
  });

test.afterEach(() => {
  process.env = { ...originalEnv };
  mock.restoreAll();
});

test("asset validator returns rich diagnostics and ok=true for primary/fallback/coach", async () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "primary-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "fallback-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "coach-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_SUBDIR = "resolve/main";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_WASM_FILENAME = "coach/coach.wasm";

  mock.method(globalThis, "fetch", async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    const isRange = headers.get("Range") === "bytes=0-1023";

    if (method === "OPTIONS") {
      return makeBinaryResponse(403, {
        vary: "Origin",
      });
    }

    if (url.includes("mlc-chat-config.json")) {
      if (method === "HEAD") {
        return makeJsonResponse(200, {}, { etag: '"cfg-etag"', "access-control-allow-origin": "https://gomdory.com", vary: "Origin" });
      }
      return makeJsonResponse(200, { model: "x" }, { etag: '"cfg-etag"', "access-control-allow-origin": "https://gomdory.com", vary: "Origin" });
    }

    if (url.includes(".wasm")) {
      if (method === "HEAD") {
        return makeBinaryResponse(200, { etag: '"wasm-etag"', "accept-ranges": "bytes", "access-control-allow-origin": "https://gomdory.com", vary: "Origin" });
      }
      if (method === "GET" && isRange) {
        return makeBinaryResponse(206, {
          etag: '"wasm-etag"',
          "accept-ranges": "bytes",
          "content-range": "bytes 0-1023/999999",
          "access-control-allow-origin": "https://gomdory.com",
          vary: "Origin",
        });
      }
      return makeBinaryResponse(200, { etag: '"wasm-etag"', "accept-ranges": "bytes" });
    }

    return makeBinaryResponse(404);
  });

  const response = await assetValidatorGet(
    new NextRequest(new Request("http://localhost/api/v1/edu/webllm/asset-validator")),
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok?: boolean;
    guidance?: { options?: string };
    canonicalStatus?: string;
    runtimeModelOrder?: string[];
    primary?: { ok?: boolean; summary?: { rangeOk?: boolean } };
    fallback?: { ok?: boolean };
    coach?: { ok?: boolean };
  };

  assert.equal(body.ok, true);
  assert.equal(body.canonicalStatus, "WEBLLM_READY");
  assert.deepEqual(body.runtimeModelOrder, ["primary-model", "fallback-model"]);
  assert.equal(body.primary?.ok, true);
  assert.equal(body.fallback?.ok, true);
  assert.equal(body.coach?.ok, true);
  assert.equal(body.primary?.summary?.rangeOk, true);
  assert.match(body.guidance?.options ?? "", /Do not add OPTIONS/);
});

test("asset validator returns RANGE_UNSUPPORTED root cause when range headers are missing", async () => {
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID = "primary-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID = "fallback-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID = "coach-model";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE = "https://models.example.com";
  process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE = "https://models.example.com/libs";

  mock.method(globalThis, "fetch", async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("mlc-chat-config.json")) {
      return makeJsonResponse(200, { model: "x" }, { "access-control-allow-origin": "https://gomdory.com" });
    }

    if (url.includes(".wasm") && method === "HEAD") {
      return makeBinaryResponse(200, { "access-control-allow-origin": "https://gomdory.com" });
    }

    if (url.includes(".wasm") && method === "GET") {
      return makeBinaryResponse(200, { "access-control-allow-origin": "https://gomdory.com" });
    }

    return makeBinaryResponse(404);
  });

  const response = await assetValidatorGet(
    new NextRequest(new Request("http://localhost/api/v1/edu/webllm/asset-validator")),
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok?: boolean;
    canonicalStatus?: string;
    primary?: { rootCause?: { failureCode?: string; url?: string; recommendedFix?: string } };
  };

  assert.equal(body.ok, false);
  assert.equal(body.canonicalStatus, "WEBLLM_READY");
  assert.equal(body.primary?.rootCause?.failureCode, "RANGE_UNSUPPORTED");
  assert.match(body.primary?.rootCause?.url ?? "", /\.wasm/);
  assert.match(body.primary?.rootCause?.recommendedFix ?? "", /Accept-Ranges/);
});

test("asset validator returns 403 WEBLLM_DOWNLOAD_BLOCKED for sample lesson without jt", async () => {
  const request = new NextRequest("https://www.gomdory.com/api/v1/edu/webllm/asset-validator", {
    headers: {
      referer: "https://www.gomdory.com/edu/lesson/1",
    },
  });

  const response = await assetValidatorGet(request);
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "WEBLLM_DOWNLOAD_BLOCKED");
  assert.equal(typeof payload.requestId, "string");
});
