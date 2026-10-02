export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createKey } from "@/lib/billing/licenseKeys";
import { logAudit } from "@/lib/data/audit";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

type CreatePayload = {
  issuedTo?: string | null;
  term?: "1y" | "1m";
  seats?: number;
  maxUses?: number;
  note?: string | null;
};

function resolveExpiresAt(term: "1y" | "1m" | undefined) {
  const now = new Date();
  if (term === "1m") {
    now.setMonth(now.getMonth() + 1);
    return now;
  }
  if (term === "1y") {
    now.setFullYear(now.getFullYear() + 1);
    return now;
  }
  return null;
}

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  const { user } = await requireUserApi();
  if (!isOpsAdmin(user.email)) {
    return jsonError("forbidden", "운영자만 접근할 수 있습니다.", 403, { requestId: ops.requestId });
  }

  const body = (await request.json().catch(() => ({}))) as CreatePayload;
  const seats = Number.isFinite(body.seats) && (body.seats ?? 1) > 0 ? Math.max(1, Number(body.seats)) : 1;
  const maxUses = Number.isFinite(body.maxUses) && (body.maxUses ?? 1) > 0 ? Math.max(1, Number(body.maxUses)) : 1;
  const term = body.term ?? "1y";

  const expiresAt = resolveExpiresAt(term);

  const { code, record } = await createKey({
    createdBy: user.id,
    expiresAt,
    seats,
    maxUses,
    issuedTo: body.issuedTo ?? null,
    note: body.note ?? null,
    plan: "pro",
  });

  void logAudit({
    action: "license_created",
    targetType: "license",
    targetId: record.id,
    meta: {
      issuedTo: record.issued_to,
      expiresAt: record.expires_at,
      seats: record.seats,
      maxUses: record.max_uses,
      createdBy: user.id,
    },
  });

  return jsonOk({ code, license: record, requestId: ops.requestId });
}

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
