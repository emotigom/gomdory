import { apiV1Path } from "@/lib/standards/pathTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logWithContext } from "@/lib/ops/logWithContext";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { validateSupabaseEnv } from "@/lib/server/env";
import { checkAndIncrement, SupabaseRateLimitStore, type RateLimitStore } from "@/lib/security/rateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { refreshStorageUsageDaily, type StorageUsageSnapshot } from "@/lib/storage/usage.server";

const ROUTE_NAME = apiV1Path("storage/refresh");
const DEFAULT_TIMEOUT_MS = 2000;

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
  refreshStorageUsageDailyFn?: typeof refreshStorageUsageDaily;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  rateLimitStore?: RateLimitStore;
  timeoutMs?: number;
  nowFn?: () => Date;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      const handle = setTimeout(() => {
        clearTimeout(handle);
        reject(new Error("timeout"));
      }, timeoutMs);
    }),
  ]);
}

async function handlePost(
  request: NextRequest,
  _context: unknown,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const validateEnv = deps?.validateSupabaseEnvFn ?? validateSupabaseEnv;
  const refreshUsage = deps?.refreshStorageUsageDailyFn ?? refreshStorageUsageDaily;
  const rateLimitStore =
    deps?.rateLimitStore ?? new SupabaseRateLimitStore(deps?.createSupabaseAdminClientFn?.() ?? createSupabaseAdminClient());
  const timeoutMs = deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const nowFn = deps?.nowFn ?? (() => new Date());

  const log = (status: number, context?: Record<string, unknown>) => {
    logWithContext({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      stage: "storage_refresh",
      requestId: ops.requestId,
      route: request.nextUrl.pathname,
      status,
      meta: context ?? null,
    });
  };

  const respond = (response: Response, context?: Record<string, unknown>) => {
    response.headers.set("cache-control", "no-store");
    log(response.status, context);
    return response;
  };

  const envValidation = validateEnv({ requireServiceRoleKey: true });

  if (!envValidation.ok) {
    return respond(
      Response.json(
        {
          ok: false,
          error: {
            code: "supabase_env_missing",
            message: "저장소 정보를 갱신할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
          requestId: ops.requestId,
        },
        { status: 200 },
      ),
      { code: "supabase_env_missing" },
    );
  }

  let userId: string | null = null;

  try {
    const auth = await ensureUser();
    userId = auth.user.id;
  } catch {
    return respond(
      Response.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "로그인이 필요합니다." },
          requestId: ops.requestId,
        },
        { status: 401 },
      ),
      { code: "unauthorized" },
    );
  }

  if (!userId) {
    return respond(
      Response.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "로그인이 필요합니다." },
          requestId: ops.requestId,
        },
        { status: 401 },
      ),
      { code: "unauthorized" },
    );
  }

  try {
    const rateLimit = await checkAndIncrement({
      key: `storage-refresh:${userId}`,
      limit: 1,
      windowSec: 600,
      store: rateLimitStore,
    });

    if (!rateLimit.allowed) {
      return respond(
        Response.json(
          {
            ok: false,
            error: {
              code: "rate_limited",
              message: "잠시 후 다시 시도해 주세요.",
              retryAfterSec: rateLimit.retryAfterSec,
            },
            requestId: ops.requestId,
          },
          { status: 429 },
        ),
        { code: "rate_limited" },
      );
    }

    const latest: StorageUsageSnapshot = await withTimeout(refreshUsage(userId, nowFn()), timeoutMs);
    return respond(Response.json({ ok: true, latest, requestId: ops.requestId }), { code: "ok", route: ROUTE_NAME });
  } catch (error) {
    const supabaseErrorCode =
      typeof error === "object" && error && "code" in error && typeof (error as { code?: string }).code === "string"
        ? (error as { code?: string }).code
        : undefined;

    return respond(
      Response.json(
        {
          ok: false,
          error: {
            code: "storage_refresh_failed",
            message: "저장소 정보를 갱신할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
          requestId: ops.requestId,
        },
        { status: 200 },
      ),
      { code: "storage_refresh_failed", supabaseErrorCode },
    );
  }
}

export const POST = withOps(handlePost, { log: true, errorCode: "db_failed" });
