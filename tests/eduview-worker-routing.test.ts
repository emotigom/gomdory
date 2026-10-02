import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { mock } from "node:test";

import { GET as eduViewHealthGet } from "@/app/api/v1/edu/eduview/health/route";

test("eduview host routing is path-aware and safe", () => {
  const workerSource = readFileSync("custom-worker.ts", "utf8");
  const eduViewSource = readFileSync("worker/eduview/serveEduView.ts", "utf8");

  assert.doesNotMatch(
    workerSource,
    /if \(url\.hostname === "eduview\.gkrry\.com"\) \{\s*return serveEduView\(request, ctx, env\);/,
  );

  assert.match(workerSource, /if \(url\.hostname === "eduview\.gkrry\.com"\)/);
  assert.match(workerSource, /path === "\/v1\/health\/visibility" \|\| path\.startsWith\("\/v1\/"\)/);
  assert.match(workerSource, /if \(!path\.startsWith\("\/apps\/"\)\)/);
  assert.match(workerSource, /Cache-Control": "no-store"/);
  assert.match(workerSource, /Published student apps are served under \/apps\/\{deploymentId\}\//);
  assert.match(
    workerSource,
    /status: envOk && \(!hasAssets \|\| assetsBuildIdOk\) && hasRealtime \? 200 : 503/,
    "worker readiness must return non-2xx when required runtime dependencies are unavailable",
  );

  assert.doesNotMatch(eduViewSource, /Response\.redirect\("\/v1\/health\/visibility"/);
  assert.match(eduViewSource, /buildTextResponse\("EduView legacy endpoint\. Use \/v1\/health\/visibility for health\.", 200\)/);
});

test.afterEach(() => mock.restoreAll());

test("eduview health preserves request IDs and forwards them upstream", async () => {
  let upstreamHeaders: Headers | null = null;
  mock.method(globalThis, "fetch", async (_input: URL | RequestInfo, init?: RequestInit) => {
    upstreamHeaders = new Headers(init?.headers);
    return new Response(null, { status: 200 });
  });

  const response = await eduViewHealthGet(
    new Request("http://localhost/api/v1/edu/eduview/health", {
      headers: { "x-request-id": "health-request-1" },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "health-request-1");
  assert.equal(response.headers.get("x-gom-request-id"), "health-request-1");
  assert.equal(upstreamHeaders?.get("x-request-id"), "health-request-1");
  assert.equal(upstreamHeaders?.get("x-gom-request-id"), "health-request-1");
  assert.deepEqual(await response.json(), {
    ok: true,
    origin: "https://eduview.gkrry.com",
    visibilityKv: "enabled",
    status: 200,
  });
});

test("eduview health failure is fixed-message, request-id safe, and does not expose upstream details", async () => {
  mock.method(globalThis, "fetch", async () => {
    return new Response("upstream body secret", { status: 503 });
  });

  const response = await eduViewHealthGet(
    new Request("http://localhost/api/v1/edu/eduview/health", {
      headers: { "x-gom-request-id": "health-gom-request-2" },
    }),
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-request-id"), "health-gom-request-2");
  assert.equal(response.headers.get("x-gom-request-id"), "health-gom-request-2");
  const payload = await response.json();
  assert.deepEqual(payload, {
    ok: false,
    message: "상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
  });
  assert.doesNotMatch(JSON.stringify(payload), /upstream body secret|503/);
});

test("eduview health transport failure does not expose the thrown error", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new Error("upstream authorization secret");
  });

  const response = await eduViewHealthGet(
    new Request("http://localhost/api/v1/edu/eduview/health", {
      headers: { "x-request-id": "health-request-3" },
    }),
  );

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("x-request-id"), "health-request-3");
  const payload = await response.json();
  assert.deepEqual(payload, {
    ok: false,
    message: "상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
  });
  assert.doesNotMatch(JSON.stringify(payload), /upstream authorization secret/);
});
