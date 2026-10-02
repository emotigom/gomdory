import { applyNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { readOpenAiDebugPingEnabled, readOpenAiModel } from "@/lib/env/appConfig";
import { toSnakeKeys } from "@/lib/standards/fields";
import { isOpenAiDirectDisabled, postEduAiBackend } from "@/lib/server/eduAiBackendClient";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { buildOpenAiAuthHeaders, readOpenAiApiKeyFromEnv } from "@/lib/server/openaiRuntime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEGACY_DIRECT_MODE = "legacy_direct";
const UPSTREAM_MODE = "upstream";
const BACKEND_ONLY_MODE = "backend_only";

type DebugPingDeps = {
  enabled: () => boolean;
  requireUser: typeof requireUserApi;
  isOpsAdmin: typeof isOpsAdmin;
  probeBackend: typeof postEduAiBackend;
  isDirectDisabled: typeof isOpenAiDirectDisabled;
  readApiKey: typeof readOpenAiApiKeyFromEnv;
  readModel: typeof readOpenAiModel;
  fetch: typeof globalThis.fetch;
};

declare global {
  // Test-only dependency seam; production always uses defaultDeps below.
  var __OPENAI_DEBUG_PING_TEST_DEPS__: Partial<DebugPingDeps> | undefined;
}

const defaultDeps: DebugPingDeps = {
  enabled: readOpenAiDebugPingEnabled,
  requireUser: requireUserApi,
  isOpsAdmin,
  probeBackend: postEduAiBackend,
  isDirectDisabled: isOpenAiDirectDisabled,
  readApiKey: readOpenAiApiKeyFromEnv,
  readModel: readOpenAiModel,
  fetch: globalThis.fetch,
};

function json(payload: Record<string, unknown>, status: number): Response {
  const headers = applyNoStoreHeaders(new Headers({ "content-type": "application/json" }));
  return Response.json(payload, { status, headers });
}

async function runLegacyDirect(deps: DebugPingDeps): Promise<Response> {
  if (deps.isDirectDisabled()) return json({ ok: false, code: "upstream_unavailable" }, 503);

  const apiKey = deps.readApiKey().apiKey;
  if (!apiKey) return json({ ok: false, code: "provider_unavailable" }, 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const { headers } = buildOpenAiAuthHeaders(apiKey, { "Content-Type": "application/json" });
    const response = await deps.fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(toSnakeKeys({
        model: deps.readModel(),
        input: [{ role: "user", content: [{ type: "text", text: "pong" }] }],
        maxOutputTokens: 8,
      })),
    });
    return response.ok
      ? json({ ok: true, backend: "not_requested", upstream: "reachable" }, 200)
      : json({ ok: false, code: "upstream_failed" }, 502);
  } catch {
    return json({ ok: false, code: "upstream_failed" }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function resolveDeps(): DebugPingDeps {
  if (readEnvString("NODE_ENV") === "test") {
    return { ...defaultDeps, ...(globalThis.__OPENAI_DEBUG_PING_TEST_DEPS__ ?? {}) };
  }
  return defaultDeps;
}

async function handleGet(request: Request, deps: DebugPingDeps): Promise<Response> {
  // Keep the disabled response first so production does not advertise this debug route.
  if (!deps.enabled()) return json({ ok: false, code: "not_found" }, 404);

  let user: Awaited<ReturnType<typeof requireUserApi>>["user"];
  try {
    ({ user } = await deps.requireUser());
  } catch {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  if (!deps.isOpsAdmin(user.email)) return json({ ok: false, code: "forbidden" }, 403);

  const mode = new URL(request.url).searchParams.get("mode");
  if (mode && mode !== BACKEND_ONLY_MODE && mode !== UPSTREAM_MODE && mode !== LEGACY_DIRECT_MODE) {
    return json({ ok: false, code: "invalid_mode" }, 400);
  }

  if (!mode || mode === BACKEND_ONLY_MODE) {
    return json({ ok: true, backend: "reachable", upstream: "not_requested" }, 200);
  }

  if (mode === LEGACY_DIRECT_MODE) return runLegacyDirect(deps);

  const route = new URL(request.url).pathname;
  const backend = await deps.probeBackend({ route, kind: "health", requestId: crypto.randomUUID(), payload: { ping: true } });
  return backend.ok
    ? json({ ok: true, backend: "reachable", upstream: "reachable" }, 200)
    : json({ ok: false, code: "upstream_failed" }, 502);
}

export async function GET(request: Request): Promise<Response> {
  return handleGet(request, resolveDeps());
}
