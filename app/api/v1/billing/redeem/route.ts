export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { redeemLicenseCode } from "@/lib/billing/entitlements";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  let code: string | null = null;
  try {
    const body = (await request.json().catch(() => null)) as { code?: string } | null;
    code = typeof body?.code === "string" ? body.code : null;
  } catch {
    code = null;
  }

  if (!code || !code.trim()) {
    return jsonError("invalid_code", "라이선스 코드를 입력해주세요.", 400, { requestId: ops.requestId });
  }

  try {
    const { user } = await requireUserApi();
    const summary = await redeemLicenseCode(user.id, code);
    return jsonOk({ ...summary, requestId: ops.requestId });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    const message = error instanceof Error ? error.message : String(error);
    const normalized = typeof message === "string" ? message : "unknown_error";

    if (unauthorized) {
      return jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId: ops.requestId });
    }

    if (normalized === "invalid_code") {
      return jsonError("invalid_code", "라이선스 코드를 찾을 수 없습니다.", 404, { requestId: ops.requestId });
    }

    if (normalized === "expired") {
      return jsonError("expired", "만료된 라이선스 코드입니다.", 410, { requestId: ops.requestId });
    }

    if (normalized === "max_uses_reached") {
      return jsonError("max_uses_reached", "사용 한도가 초과된 코드입니다.", 409, { requestId: ops.requestId });
    }

    return jsonError("license_redeem_failed", "라이선스를 적용하지 못했습니다.", 502, { requestId: ops.requestId });
  }
}

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
