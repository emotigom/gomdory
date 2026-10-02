// Export the Durable Object from the entry file so Wrangler can always find it.
import { RealtimeRoomV2 as RealtimeRoomV2Impl } from "./worker/realtime/RealtimeRoomV2";
import { EduP2PRoom as EduP2PRoomImpl, handleEduP2PRampupRequest } from "./worker/edu/p2p/EduP2PRoom";
export class RealtimeRoomV2 extends RealtimeRoomV2Impl {}
import { EduP2PRoom as EduP2PRoomImpl } from "./worker/edu/p2p/EduP2PRoom";
export class EduP2PRoom extends EduP2PRoomImpl {}

// @ts-ignore `.open-next/worker.js` is generated at build time
import handler from "./.open-next/worker.js";
import type { CloudflareEnv } from "./cloudflare-env";
// @ts-ignore `.open-next/worker.js` is generated at build time
// OpenNext may emit queue/tag cache Durable Objects; re-export safely to satisfy Wrangler bindings.
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
import { validateSupabaseEnv } from "./lib/server/env";
import { buildError } from "./lib/server/errorResponse";
import { recordOpsEvent } from "./lib/ops/recordEvent";
import { createSupabaseAdminClient } from "./lib/supabase/admin";
import { serveEduView } from "./worker/eduview/serveEduView";
import { isEmergencyMode, isReadOnlyMode } from "./lib/flags/emergency";
import { getOrCreateRequestId } from "./lib/http/requestId";

declare global {
  // eslint-disable-next-line no-var
  var __CLOUDFLARE_ENV__: CloudflareEnv | undefined;
}

const openNextFetch: ExportedHandlerFetchHandler<CloudflareEnv> = handler.fetch.bind(handler);

const NOT_FOUND_SAMPLE_RATE = 20; // 1 in N
const NOT_FOUND_HARD_LIMIT_PER_MINUTE = 20;
const EDU_CLEANUP_PROJECT_LIMIT = 100;
const EDU_CLEANUP_OBJECT_LIMIT = 500;
const EDU_CLEANUP_DELETE_BATCH = 200;
const OPS_UI_ERROR_PATH = "/api/v1/ops/ui-error";
const EMERGENCY_ALLOWLIST_PATHS = [
  "/",
  "/__health",
  "/api/v1/system/diag",
];
const EMERGENCY_ALLOWLIST_PREFIXES = [
  "/api/v1/ops",
  "/auth",
];
const STATIC_ASSET_PREFIXES = [
  "/_next/",
  "/favicon",
  "/sitemap",
];
const STATIC_ASSET_PATHS = [
  "/BUILD_ID",
  "/robots.txt",
  "/site.webmanifest",
  "/manifest.json",
];
const READONLY_WRITE_ALLOWLIST_PREFIXES = ["/api/v1/ops"];
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildOpsUiErrorHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "cache-control": "no-store",
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-smoke-test",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  return headers;
}

function respondOpsUiError(
  request: Request,
  requestId: string,
  {
    received,
    note,
  }: {
    received?: boolean;
    note?: string;
  } = {},
) {
  const payload: { ok: true; requestId: string; received?: boolean; note?: string } = {
    ok: true,
    requestId,
  };
  if (typeof received === "boolean") {
    payload.received = received;
  }
  if (note) {
    payload.note = note;
  }
  return Response.json(payload, { status: 200, headers: buildOpsUiErrorHeaders(request) });
}

function truncate(value: string | null | undefined, max = 140) {
  if (!value) return null;
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function isStaticAssetPath(path: string) {
  return (
    STATIC_ASSET_PATHS.includes(path) ||
    STATIC_ASSET_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

function isEmergencyAllowlisted(path: string) {
  return (
    EMERGENCY_ALLOWLIST_PATHS.includes(path) ||
    EMERGENCY_ALLOWLIST_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    isStaticAssetPath(path)
  );
}

function isReadOnlyWriteAllowed(path: string) {
  return READONLY_WRITE_ALLOWLIST_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function buildEmergencyBlockResponse(code: "EMERGENCY_MODE" | "EMERGENCY_READONLY") {
  return Response.json(
    {
      ok: false,
      code,
      retryable: true,
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function isLikelyTokenSegment(segment: string) {
  if (!segment) return false;
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  // long-ish hex/base64url-ish tokens
  if (/^[0-9a-f]{16,}$/i.test(segment)) return true;
  if (/^[A-Za-z0-9_-]{24,}$/.test(segment)) return true;
  // long numeric ids
  if (/^\d{6,}$/.test(segment)) return true;
  return false;
}

function normalizePathname(pathname: string) {
  const raw = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  const parts = raw.split("/").filter(Boolean);
  const normalized = parts.map((seg) => (isLikelyTokenSegment(seg) ? ":id" : seg));
  return `/${normalized.join("/")}`;
}

function safeParseUrl(input: string) {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

async function listR2KeysWithLimit(
  bucket: R2Bucket,
  prefix: string,
  maxKeys: number,
) {
  const keys: string[] = [];
  let cursor: string | undefined;
  let hasMore = false;

  while (keys.length < maxKeys) {
    const result = await bucket.list({
      prefix,
      cursor,
      limit: Math.min(1000, maxKeys - keys.length),
    });

    keys.push(...result.objects.map((object) => object.key));

    if (!result.truncated) {
      hasMore = false;
      break;
    }

    cursor = result.cursor;
    hasMore = true;
  }

  return { keys, hasMore };
}

async function deleteR2Keys(bucket: R2Bucket, keys: string[]) {
  for (let i = 0; i < keys.length; i += EDU_CLEANUP_DELETE_BATCH) {
    const batch = keys.slice(i, i + EDU_CLEANUP_DELETE_BATCH);
    if (batch.length > 0) {
      await bucket.delete(batch);
    }
  }
}

async function cleanupExpiredEduProjects(env: CloudflareEnv) {
  if (!env.EDU_BUCKET) {
    throw new Error("EDU_BUCKET binding missing");
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: expiredProjects, error } = await supabase
    .from("edu_projects")
    .select("id, slug, expires_at")
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(EDU_CLEANUP_PROJECT_LIMIT);

  if (error) {
    throw new Error(`Failed to load expired projects: ${error.message}`);
  }

  let deletedProjects = 0;
  let deletedObjects = 0;
  let skippedProjects = 0;

  for (const project of expiredProjects ?? []) {
    if (deletedObjects >= EDU_CLEANUP_OBJECT_LIMIT) {
      break;
    }

    const remainingObjectBudget = EDU_CLEANUP_OBJECT_LIMIT - deletedObjects;
    const prefix = `edu/v1/${project.slug}/`;
    const { keys, hasMore } = await listR2KeysWithLimit(env.EDU_BUCKET, prefix, remainingObjectBudget);

    if (keys.length > 0) {
      await deleteR2Keys(env.EDU_BUCKET, keys);
      deletedObjects += keys.length;
    }

    if (hasMore) {
      skippedProjects += 1;
      continue;
    }

    const { error: filesError } = await supabase
      .from("edu_project_files")
      .delete()
      .eq("project_id", project.id);
    if (filesError) {
      console.warn("[edu_cleanup] failed to delete edu_project_files", {
        projectId: project.id,
        message: filesError.message,
      });
      skippedProjects += 1;
      continue;
    }

    const { error: projectError } = await supabase.from("edu_projects").delete().eq("id", project.id);
    if (projectError) {
      console.warn("[edu_cleanup] failed to delete edu_projects row", {
        projectId: project.id,
        message: projectError.message,
      });
      skippedProjects += 1;
      continue;
    }

    deletedProjects += 1;
  }

  return {
    expiredCount: expiredProjects?.length ?? 0,
    deletedProjects,
    deletedObjects,
    skippedProjects,
  };
}

function shouldLogNotFound(request: Request, path: string) {
  // Ignore assets noise
  if (
    path === "/__health" ||
    path === "/BUILD_ID" ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path === "/robots.txt" ||
    path.startsWith("/sitemap")
  ) {
    return false;
  }

  // Focus on page-level 404s (not API)
  if (path.startsWith("/api/")) return false;

  // Mostly navigations
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const accept = request.headers.get("accept") ?? "";
  const wantsHtml = accept.includes("text/html");

  // Allow dashboards even if accept is weird (e.g., some clients)
  if (path.startsWith("/dashboard")) return true;

  return wantsHtml;
}

export default {
  async fetch(request, env, ctx) {
    const startedAt = Date.now();
    const requestId = request.headers.get("cf-ray") ?? getOrCreateRequestId(request);
    let url: URL | null = null;
    let path = "unknown";
    const method = request.method;

    try {
      url = new URL(request.url);
      path = url.pathname;

      globalThis.__CLOUDFLARE_ENV__ = env;

      const emergencyMode = isEmergencyMode();
      const readOnlyMode = isReadOnlyMode();

      if (emergencyMode && !isEmergencyAllowlisted(path)) {
        return buildEmergencyBlockResponse("EMERGENCY_MODE");
      }

      if (readOnlyMode && WRITE_METHODS.has(method) && !isReadOnlyWriteAllowed(path)) {
        return buildEmergencyBlockResponse("EMERGENCY_READONLY");
      }

      console.log(
        JSON.stringify({
          level: "info",
          event: "request.start",
          requestId,
          method,
          path,
        }),
      );

      if (path === OPS_UI_ERROR_PATH) {
        if (method === "POST") {
          let payload: unknown | null = null;
          try {
            payload = await request.json();
          } catch {
            payload = null;
          }
          if (payload) {
            console.log(
              JSON.stringify({
                level: "info",
                event: "ops.ui_error.received",
                requestId,
                hasPayload: true,
              }),
            );
          }
          return respondOpsUiError(request, requestId, { received: Boolean(payload) });
        }

        if (method === "OPTIONS") {
          return respondOpsUiError(request, requestId, { note: "preflight" });
        }

        if (method === "GET") {
          return respondOpsUiError(request, requestId, { note: "ok" });
        }

        return respondOpsUiError(request, requestId, { note: "method_not_allowed" });
      }

      if (request.method === "GET" && path === "/__health") {
        const hasAssets = Boolean(env.ASSETS);
        const hasRealtime = Boolean(env.REALTIME_ROOM);
        const supabaseEnv = validateSupabaseEnv({ source: env as Record<string, unknown> });
        const envOk = supabaseEnv.ok;
        let assetsBuildIdOk = false;

        if (hasAssets) {
          try {
            const assetResponse = await env.ASSETS.fetch(new Request(new URL("/BUILD_ID", request.url)));
            assetsBuildIdOk = assetResponse.ok;
          } catch (error) {
            console.error(
              JSON.stringify({
                level: "error",
                event: "health.assets_build_id_failed",
                requestId,
                path,
                message: error instanceof Error ? error.message : String(error),
              }),
              error,
            );
          }
        }

        return Response.json({
          ok: envOk && (!hasAssets || assetsBuildIdOk) && hasRealtime,
          hasAssets,
          hasRealtime,
          assetsBuildIdOk,
          supabaseEnv: supabaseEnv.ok
            ? { ok: true }
            : {
                ok: false,
                missing: supabaseEnv.missing,
                code: "supabase_env_missing",
                message: supabaseEnv.message,
              },
          workerName: (env as { WORKER_NAME?: string })?.WORKER_NAME,
          ts: new Date().toISOString(),
          requestId,
          path,
        }, { status: envOk && (!hasAssets || assetsBuildIdOk) && hasRealtime ? 200 : 503 });
      }

      if (url.hostname === "eduview.gkrry.com") {
        if (path === "/" || path === "") {
          return new Response(
            "Gomdory EduView is ready. Published student apps are served under /apps/{deploymentId}/.",
            {
              status: 200,
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
              },
            },
          );
        }

        if (path === "/v1/health/visibility" || path.startsWith("/v1/")) {
          return serveEduView(request, ctx, env);
        }

        if (!path.startsWith("/apps/")) {
          return new Response("Not Found", {
            status: 404,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }
      }

      if (path === "/__edu_p2p/ws" && request.headers.get("upgrade") === "websocket") {
        const roomKey = url.searchParams.get("code")?.trim();
        if (!roomKey) {
          return Response.json({ ok: false, error: "missing_room" }, { status: 400 });
        }
        const stub = env.EDU_P2P_ROOM.get(env.EDU_P2P_ROOM.idFromName(roomKey));
        return stub.fetch(request);
      }

      if (path.startsWith("/__edu_p2p/lease")) {
        const roomKey = url.searchParams.get("code")?.trim();
        if (!roomKey) {
          return Response.json({ ok: false, error: "missing_room" }, { status: 400 });
        }
        const stub = env.EDU_P2P_ROOM.get(env.EDU_P2P_ROOM.idFromName(roomKey));
        return stub.fetch(request);
      }

      if (env.ASSETS && (request.method === "GET" || request.method === "HEAD")) {
        const shouldServeFromAssets =
          path === "/BUILD_ID" ||
          path.startsWith("/_next/") ||
          path.startsWith("/favicon") ||
          path === "/robots.txt" ||
          path.startsWith("/sitemap");

        if (shouldServeFromAssets) {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse.status !== 404) {
            return assetResponse;
          }
        }
      }

      try {
        const response = await openNextFetch(request, env, ctx);
        const durationMs = Date.now() - startedAt;
        const status = response.status;

        if (status === 404 && shouldLogNotFound(request, path)) {
          const normalizedPath = normalizePathname(path);
          const refererUrl = safeParseUrl(request.headers.get("referer") ?? "");
          const refererHost = refererUrl?.host ?? null;
          const refererPath = refererUrl?.pathname ? normalizePathname(refererUrl.pathname) : null;

          ctx.waitUntil(
            recordOpsEvent(
              {
                level: "warn",
                kind: "not_found",
                request_id: requestId,
                route: normalizedPath,
                status,
                duration_ms: durationMs,
                meta: {
                  source: "worker",
                  method,
                  host: url.host,
                  refererHost,
                  refererPath,
                  ua: truncate(request.headers.get("user-agent"), 200),
                  accept: truncate(request.headers.get("accept"), 120),
                },
              },
              {
                sampleRate: NOT_FOUND_SAMPLE_RATE,
                hardLimitPerMinute: NOT_FOUND_HARD_LIMIT_PER_MINUTE,
              },
            ),
          );
        }

        const event = status >= 400 ? "request.failure" : "request.success";
        const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        console.log(
          JSON.stringify({
            level,
            event,
            requestId,
            method,
            path,
            status,
            durationMs,
          }),
        );
        return response;
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "request.failed",
            requestId,
            method,
            path,
            message: error instanceof Error ? error.message : String(error),
          }),
          error,
        );
        return buildError({
          code: "WORKER_INTERNAL_ERROR",
          message: "일시적인 오류...",
          requestId,
          retryable: true,
          status: 500,
        });
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "request.failed",
          requestId,
          method,
          path,
          message: error instanceof Error ? error.message : String(error),
        }),
        error,
      );
      return buildError({
        code: "WORKER_INTERNAL_ERROR",
        message: "일시적인 오류...",
        requestId,
        retryable: true,
        status: 500,
      });
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;

export async function scheduled(event: ScheduledEvent, env: CloudflareEnv, ctx: ExecutionContext) {
  globalThis.__CLOUDFLARE_ENV__ = env;
  const scheduledAt = event.scheduledTime ? new Date(event.scheduledTime) : new Date();

  try {
    const result = await cleanupExpiredEduProjects(env);
    ctx.waitUntil(
      recordOpsEvent(
        {
          level: "info",
          kind: "edu_cleanup",
          route: "scheduled",
          status: 200,
          meta: {
            stage: "edu_cleanup",
            scheduledAt: scheduledAt.toISOString(),
            expiredCount: result.expiredCount,
            deletedProjects: result.deletedProjects,
            deletedObjects: result.deletedObjects,
            skippedProjects: result.skippedProjects,
            result: "success",
          },
        },
        { sampleRate: 1, hardLimitPerMinute: 60 },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        event: "edu_cleanup_failed",
        message,
      }),
      error,
    );
    ctx.waitUntil(
      recordOpsEvent(
        {
          level: "error",
          kind: "edu_cleanup",
          route: "scheduled",
          status: 500,
          meta: {
            stage: "edu_cleanup",
            scheduledAt: scheduledAt.toISOString(),
            error: message,
            result: "failed",
          },
        },
        { sampleRate: 1, hardLimitPerMinute: 60 },
      ),
    );
  }
}
