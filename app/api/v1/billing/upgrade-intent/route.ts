export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

const allowedContexts = new Set(["storage", "files", "templates", "general"]);

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  let context: string | null = null;
  let note: string | null = null;

  try {
    const body = (await request.json().catch(() => null)) as { context?: string; note?: string } | null;
    context = typeof body?.context === "string" ? body.context : null;
    note = typeof body?.note === "string" ? body.note : null;
  } catch {
    // ignored
  }

  if (!context || !allowedContexts.has(context)) {
    return jsonError("invalid_context", "업그레이드 사유를 선택해주세요.", 400, { requestId: ops.requestId });
  }

  try {
    const { user } = await requireUserApi();
    void logAudit({
      boardId: null,
      action: "upgrade_intent",
      targetType: "plan",
      targetId: user.id,
      meta: { context, note },
    });

    return jsonOk({ ok: true, requestId: ops.requestId });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    if (unauthorized) {
      return jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId: ops.requestId });
    }

    return jsonError("upgrade_intent_failed", "요청을 기록하지 못했습니다.", 502, { requestId: ops.requestId });
  }
}

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
