import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

type Params = { id: string };

const VALID_STATUS = new Set(["new", "contacted", "approved", "rejected"]);

async function handlePatch(
  request: Request,
  { params }: { params: Promise<Params> },
  ops: WithOpsContext,
) {
  const { user } = await requireUserApi();
  if (!isOpsAdmin(user.email)) {
    return jsonError("forbidden", "권한이 없습니다.", 403, { requestId: ops.requestId });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const status = typeof body.status === "string" ? body.status : "";

  if (!VALID_STATUS.has(status)) {
    return jsonError("invalid_status", "상태 값을 확인해주세요.", 400, { requestId: ops.requestId });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("upgrade_requests")
    .update({ status: status as "new" | "contacted" | "approved" | "rejected" })
    .eq("request_id", id)
    .select("request_id, status, created_at")
    .maybeSingle();

  if (error || !data) {
    return jsonError("update_failed", "업데이트하지 못했습니다.", 502, { requestId: ops.requestId });
  }

  return jsonOk({
    requestId: data.request_id,
    status: data.status,
    createdAt: data.created_at,
    meta: { requestId: ops.requestId },
  });
}

export const PATCH = withOps(handlePatch, { log: true });
