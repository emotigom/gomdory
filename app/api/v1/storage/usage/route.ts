import { apiV1Path } from "@/lib/standards/pathTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logWithContext } from "@/lib/ops/logWithContext";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateSupabaseEnv } from "@/lib/server/env";
import {
  buildTrendRange,
  fetchStorageQuotaBytes,
  fetchStorageUsageDaily,
  refreshStorageUsageDaily,
  type StorageUsageSnapshot,
} from "@/lib/storage/usage.server";
import { checkAndIncrement, SupabaseRateLimitStore, type RateLimitStore } from "@/lib/security/rateLimit";

const ROUTE_NAME = apiV1Path("storage/usage");

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
  fetchStorageUsageDailyFn?: typeof fetchStorageUsageDaily;
  refreshStorageUsageDailyFn?: typeof refreshStorageUsageDaily;
  fetchStorageQuotaBytesFn?: typeof fetchStorageQuotaBytes;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
  rateLimitStore?: RateLimitStore;
  nowFn?: () => Date;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 2000;
const TREND_DAYS = 7;

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

async function handleGet(
  request: NextRequest,
  _context: unknown,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const validateEnv = deps?.validateSupabaseEnvFn ?? validateSupabaseEnv;
  const fetchUsageDaily = deps?.fetchStorageUsageDailyFn ?? fetchStorageUsageDaily;
  const refreshUsageDaily = deps?.refreshStorageUsageDailyFn ?? refreshStorageUsageDaily;
  const fetchQuotaBytes = deps?.fetchStorageQuotaBytesFn ?? fetchStorageQuotaBytes;
  const rateLimitStore =
    deps?.rateLimitStore ?? new SupabaseRateLimitStore(deps?.createSupabaseAdminClientFn?.() ?? createSupabaseAdminClient());
  const nowFn = deps?.nowFn ?? (() => new Date());
  const timeoutMs = deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const log = (status: number, context?: Record<string, unknown>) => {
    logWithContext({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      stage: "storage_usage",
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
            message: "저장소 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
          requestId: ops.requestId,
        },
        { status: 200 },
      ),
      { code: "supabase_env_missing", hint: "supabase_env_missing" },
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
      { code: "unauthorized", hint: "supabase_auth_failed" },
    );
  }

  if (!userId) {
    return respond(
      Response.json(
        {
          ok: false,
          error: {
            code: "unauthorized",
            message: "로그인이 필요합니다.",
          },
          requestId: ops.requestId,
        },
        { status: 401 },
      ),
      { code: "unauthorized", hint: "missing_user_id" },
    );
  }

  try {
    const now = nowFn();
    const today = now.toISOString().slice(0, 10);
    const [quotaBytes, recentSnapshots] = await Promise.all([
      fetchQuotaBytes(userId),
      fetchUsageDaily(userId, TREND_DAYS),
    ]);

    let latest = recentSnapshots.find((entry) => entry.day === today) ?? recentSnapshots[0] ?? null;

    const rateLimit = await checkAndIncrement({
      key: `storage-usage:${userId}`,
      limit: 1,
      windowSec: 30,
      store: rateLimitStore,
    });

    if (!latest || (latest.day !== today && rateLimit.allowed)) {
      try {
        const refreshed = await withTimeout(refreshUsageDaily(userId, now), timeoutMs);
        latest = refreshed;
        recentSnapshots.unshift(refreshed);
      } catch (error) {
        console.warn("[storage_usage] refresh skipped", error);
      }
    }

    const resolvedLatest: StorageUsageSnapshot =
      latest ?? {
        day: today,
        r2Bytes: 0,
        dbBytes: 0,
        filesCount: 0,
        optimizedBytesSaved: 0,
      };

    const trend = buildTrendRange(now, recentSnapshots, TREND_DAYS);

    return respond(
      Response.json({
        ok: true,
        quotaBytes,
        latest: resolvedLatest,
        trend,
        requestId: ops.requestId,
      }),
      { code: "ok", route: ROUTE_NAME },
    );
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
            code: "storage_usage_failed",
            message: "저장소 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
          requestId: ops.requestId,
        },
        { status: 200 },
      ),
      { code: "storage_usage_failed", supabaseErrorCode },
    );
  }
}

export const GET = withOps(handleGet, { log: true, errorCode: "db_failed" });
