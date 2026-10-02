import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

async function handleGet(_request: Request, _context: unknown, ops: WithOpsContext) {
  const { user } = await requireUserApi();
  if (!isOpsAdmin(user.email)) {
    return jsonError("forbidden", "권한이 없습니다.", 403, { requestId: ops.requestId });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("upgrade_requests")
    .select("request_id, created_at, user_id, org_name, contact_email, seats, message, status, meta")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return jsonError("upgrade_requests_fetch_failed", "업그레이드 요청을 불러오지 못했습니다.", 502, {
      requestId: ops.requestId,
    });
  }

  return jsonOk({
    requests:
      data?.map((row) => ({
        id: row.request_id,
        createdAt: row.created_at,
        userId: row.user_id,
        orgName: row.org_name,
        contactEmail: row.contact_email,
        seats: row.seats,
        message: row.message,
        status: row.status,
        meta: row.meta,
      })) ?? [],
    requestId: ops.requestId,
  });
}

export const GET = withOps(handleGet, { log: true });
