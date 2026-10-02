import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { routes } from "@/lib/standards/routes";
import { isValidStorageQuotaInput } from "@/lib/storage/quota";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE_NAME = routes.api.opsAdmin.storage.quotaUpdate();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StorageQuotaPayload = {
  ownerId: string;
  quotaBytes: number;
};

const prefixOwnerId = (ownerId: string | null) => (ownerId ? ownerId.slice(0, 8) : null);

const parsePayload = (value: unknown): StorageQuotaPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const ownerId = typeof raw.ownerId === "string" ? raw.ownerId.trim() : "";
  const quotaBytes = typeof raw.quotaBytes === "number" ? raw.quotaBytes : Number.NaN;

  if (!ownerId || !UUID_PATTERN.test(ownerId)) return null;
  if (!isValidStorageQuotaInput(quotaBytes)) return null;

  return { ownerId, quotaBytes };
};

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  let userEmail: string | null = null;
  try {
    const { user } = await requireUserApi();
    userEmail = user.email ?? null;
  } catch {
    return jsonErrorWithRequestId(
      "unauthorized",
      "로그인이 필요합니다.",
      ops.requestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!userEmail || !isOpsAdmin(userEmail)) {
    return jsonErrorWithRequestId(
      "forbidden",
      "운영자 권한이 필요합니다.",
      ops.requestId,
      403,
      { hint: "ops admin only" },
      withNoStoreHeaders(),
    );
  }

  let payload: StorageQuotaPayload | null = null;
  try {
    payload = parsePayload(await request.json());
  } catch {
    payload = null;
  }

  if (!payload) {
    return jsonErrorWithRequestId(
      "invalid_body",
      "요청 형식이 올바르지 않습니다.",
      ops.requestId,
      400,
      { hint: "invalid body" },
      withNoStoreHeaders(),
    );
  }

  const supabase = createSupabaseAdminClient();
  const upsertPayload = {
    ["owner_id"]: payload.ownerId,
    ["quota_bytes"]: payload.quotaBytes,
    ["updated_at"]: new Date().toISOString(),
  };

  const { error } = await supabase.from("storage_quota").upsert(upsertPayload, { onConflict: "owner_id" });

  if (error) {
    console.error(
      JSON.stringify({
        stage: "ops_admin_storage_quota_upsert_failed",
        route: ROUTE_NAME,
        requestId: ops.requestId,
        ownerIdPrefix: prefixOwnerId(payload.ownerId),
        supabase: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      }),
    );

    return jsonErrorWithRequestId(
      "quota_upsert_failed",
      "할당량 저장에 실패했습니다.",
      ops.requestId,
      500,
      { hint: "unexpected" },
      withNoStoreHeaders(),
    );
  }

  return jsonOkWithRequestId(
    { ownerId: payload.ownerId, quotaBytes: payload.quotaBytes },
    ops.requestId,
    withNoStoreHeaders(),
  );
}

export const POST = withOps(handlePost, { log: true, errorCode: "db_failed" });
