import { apiV1Path } from "@/lib/standards/pathTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { logWithContext } from "@/lib/ops/logWithContext";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { readEnvString } from "@/lib/server/runtimeEnv";
import { isValidStorageQuotaInput } from "@/lib/storage/quota";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ROUTE_NAME = apiV1Path("storage/quota");

type QuotaRequest = {
  ownerId?: string;
  quotaBytes?: number;
};

function readAdminKey(request: NextRequest): string | null {
  const header = request.headers.get("x-admin-key");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  const log = (status: number, context?: Record<string, unknown>) => {
    logWithContext({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      stage: "storage_quota",
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

  const adminKey = readEnvString("ADMIN_KEY");
  if (!adminKey) {
    return respond(
      Response.json(
        {
          ok: false,
          error: { code: "admin_key_missing", message: "관리자 키가 필요합니다." },
          requestId: ops.requestId,
        },
        { status: 500 },
      ),
      { code: "admin_key_missing" },
    );
  }

  const providedKey = readAdminKey(request);
  if (!providedKey || providedKey !== adminKey) {
    return respond(
      Response.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "관리자 권한이 필요합니다." },
          requestId: ops.requestId,
        },
        { status: 401 },
      ),
      { code: "unauthorized" },
    );
  }

  let payload: QuotaRequest = {};
  try {
    payload = (await request.json()) as QuotaRequest;
  } catch {
    payload = {};
  }

  const ownerId = payload.ownerId?.trim();
  const quotaBytes = payload.quotaBytes;

  if (!ownerId || !isValidStorageQuotaInput(quotaBytes)) {
    return respond(
      Response.json(
        {
          ok: false,
          error: { code: "invalid_payload", message: "ownerId와 quotaBytes를 확인하세요." },
          requestId: ops.requestId,
        },
        { status: 400 },
      ),
      { code: "invalid_payload" },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("storage_quota")
      .upsert({ owner_id: ownerId, quota_bytes: quotaBytes, updated_at: new Date().toISOString() }, { onConflict: "owner_id" })
      .select("owner_id, quota_bytes, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return respond(
      Response.json({ ok: true, quota: data, requestId: ops.requestId }),
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
            code: "storage_quota_failed",
            message: "쿼터를 업데이트할 수 없습니다. 잠시 후 다시 시도해 주세요.",
          },
          requestId: ops.requestId,
        },
        { status: 200 },
      ),
      { code: "storage_quota_failed", supabaseErrorCode },
    );
  }
}

export const POST = withOps(handlePost, { log: true, errorCode: "db_failed" });
