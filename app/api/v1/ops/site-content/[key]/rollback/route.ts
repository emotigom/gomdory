export const dynamic = "force-dynamic";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isSiteContentKey } from "@/lib/db/siteContent";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps } from "@/lib/ops/withOps";
import { rollbackSiteContent } from "@/lib/site-content/server";

async function requireOpsAdmin() {
  try {
    const { user } = await requireUserApi();
    return !!user.email && isOpsAdmin(user.email);
  } catch {
    return false;
  }
}

export const POST = withOps(async (request: Request, context: { params: Promise<{ key: string }> }, ops) => {
  if (!(await requireOpsAdmin())) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, { hint: "ops admin only" });
  }

  const { key } = await context.params;
  if (!isSiteContentKey(key)) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid key", ops.requestId, 400, { hint: "usage|updates|roadmap|policy|community_usage|community_updates|site_nav_config|board_sidebar_config" });
  }

  const body = (await request.json().catch(() => null)) as { revisionId?: unknown; note?: unknown } | null;
  if (!body || typeof body.revisionId !== "string") {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid body", ops.requestId, 400, { hint: "revisionId required" });
  }

  const result = await rollbackSiteContent(
    key,
    body.revisionId,
    typeof body.note === "string" ? body.note.slice(0, 200) : undefined,
  );

  if (!result) {
    return jsonErrorWithRequestId("NOT_FOUND", "revision not found", ops.requestId, 404, { hint: "rollback" });
  }

  return jsonOkWithRequestId(result, ops.requestId);
}, { log: true, errorCode: ErrorCodes.dbFailed });
