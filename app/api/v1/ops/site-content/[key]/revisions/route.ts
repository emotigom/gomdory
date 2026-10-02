export const dynamic = "force-dynamic";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isSiteContentKey } from "@/lib/db/siteContent";
import { listRevisions } from "@/lib/db/siteContentRevisions";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps } from "@/lib/ops/withOps";

async function requireOpsAdmin() {
  try {
    const { user } = await requireUserApi();
    return !!user.email && isOpsAdmin(user.email);
  } catch {
    return false;
  }
}

export const GET = withOps(async (request: Request, context: { params: Promise<{ key: string }> }, ops) => {
  if (!(await requireOpsAdmin())) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const { key } = await context.params;
  if (!isSiteContentKey(key)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid key", ops.requestId, 400, { hint: "usage|updates|roadmap|policy|community_usage|community_updates" });
  }

  const url = new URL(request.url);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
  const revisions = await listRevisions(key, limit);
  return jsonOkWithRequestId({ revisions }, ops.requestId);
}, { log: true, errorCode: ErrorCodes.dbFailed });
