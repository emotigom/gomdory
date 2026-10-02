import assert from "node:assert/strict";
import test from "node:test";

import * as routeModule from "@/app/api/v1/debug/openai-ping/route";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { postEduAiBackend } from "@/lib/server/eduAiBackendClient";
import { readOpenAiApiKeyFromEnv } from "@/lib/server/openaiRuntime";

const request = (mode?: string) => new Request(`http://localhost/api/v1/debug/openai-ping${mode ? `?mode=${mode}` : ""}`);
const opsUser = { id: "ops-user", email: "ops@example.test" };

function handler(options: {
  enabled?: boolean;
  user?: typeof opsUser | null;
  opsAdmin?: boolean;
  onBackendProbe?: () => void;
  onFetch?: () => void;
  directDisabled?: boolean;
}) {
  const deps = {
    enabled: () => options.enabled ?? true,
    requireUser: (async () => {
      if (!options.user) throw new Error("unauthorized");
      return { user: options.user };
    }) as typeof requireUserApi,
    isOpsAdmin: (() => options.opsAdmin ?? true) as typeof isOpsAdmin,
    probeBackend: (async () => {
      options.onBackendProbe?.();
      return { ok: true, status: 200 };
    }) as typeof postEduAiBackend,
    isDirectDisabled: () => options.directDisabled ?? false,
    readApiKey: (() => ({ apiKey: "sk-test-secret" })) as typeof readOpenAiApiKeyFromEnv,
    readModel: () => "test-model",
    fetch: (async () => {
      options.onFetch?.();
      return new Response('{"raw":"bearer token cookie"}', { status: 200 });
    }) as typeof fetch,
  };
  return async (input: Request) => {
    process.env.NODE_ENV = "test";
    globalThis.__OPENAI_DEBUG_PING_TEST_DEPS__ = deps;
    try {
      return await routeModule.GET(input);
    } finally {
      delete globalThis.__OPENAI_DEBUG_PING_TEST_DEPS__;
    }
  };
}

async function body(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

test("disabled debug ping is hidden before authentication or upstream work", async () => {
  let backendProbes = 0;
  let fetches = 0;
  const response = await handler({ enabled: false, onBackendProbe: () => backendProbes++, onFetch: () => fetches++ })(request("upstream"));

  assert.equal(response.status, 404);
  assert.equal((await body(response)).code, "not_found");
  assert.equal(backendProbes, 0);
  assert.equal(fetches, 0);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("unauthenticated and non-admin users are rejected before upstream work", async () => {
  for (const mode of ["upstream", "legacy_direct"]) {
    for (const options of [{ user: null }, { user: opsUser, opsAdmin: false }]) {
      let backendProbes = 0;
      let fetches = 0;
      const response = await handler({ ...options, onBackendProbe: () => backendProbes++, onFetch: () => fetches++ })(request(mode));

      assert.equal(response.status, options.user ? 403 : 401);
      assert.equal(backendProbes, 0);
      assert.equal(fetches, 0);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    }
  }
});

test("ops admin receives a backend-only diagnostic unless an upstream mode is explicit", async () => {
  let backendProbes = 0;
  let fetches = 0;
  const response = await handler({ user: opsUser, onBackendProbe: () => backendProbes++, onFetch: () => fetches++ })(request());

  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { ok: true, backend: "reachable", upstream: "not_requested" });
  assert.equal(backendProbes, 0);
  assert.equal(fetches, 0);
});

test("only explicit upstream modes make provider calls and responses stay redacted", async () => {
  let backendProbes = 0;
  let fetches = 0;
  const get = handler({ user: opsUser, onBackendProbe: () => backendProbes++, onFetch: () => fetches++ });

  const upstream = await get(request("upstream"));
  assert.equal(upstream.status, 200);
  assert.deepEqual(await body(upstream), { ok: true, backend: "reachable", upstream: "reachable" });
  assert.equal(backendProbes, 1);
  assert.equal(fetches, 0);

  const legacy = await get(request("legacy_direct"));
  const legacyBody = await body(legacy);
  assert.equal(legacy.status, 200);
  assert.deepEqual(legacyBody, { ok: true, backend: "not_requested", upstream: "reachable" });
  assert.equal(fetches, 1);
  assert.doesNotMatch(JSON.stringify(legacyBody), /sk-test-secret|bearer|cookie|raw/i);

  const disabledDirect = await handler({ user: opsUser, directDisabled: true, onFetch: () => fetches++ })(request("legacy_direct"));
  assert.equal(disabledDirect.status, 503);
  assert.equal(fetches, 1);
});

test("unknown modes are rejected and no additional methods are exported", async () => {
  let backendProbes = 0;
  let fetches = 0;
  const response = await handler({ user: opsUser, onBackendProbe: () => backendProbes++, onFetch: () => fetches++ })(request("unexpected"));

  assert.equal(response.status, 400);
  assert.equal((await body(response)).code, "invalid_mode");
  assert.equal(backendProbes, 0);
  assert.equal(fetches, 0);
  assert.equal("POST" in routeModule, false);
});
