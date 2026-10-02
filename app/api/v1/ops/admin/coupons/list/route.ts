export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { routes } from "@/lib/standards/routes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ROUTE_NAME = routes.api.opsAdmin.coupons.list();

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

async function handleGet(_request: Request, _context: unknown, ops: WithOpsContext) {
  let userEmail: string | null = null;
  try {
    const { user } = await requireUserApi();
    userEmail = user.email ?? null;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, {
      hint: "login required",
    });
  }

  if (!userEmail || !isOpsAdmin(userEmail)) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, {
      hint: "ops admin only",
    });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("coupon_codes")
    .select("id, code_display, expires_at, max_uses, uses, effect_type, effect_value, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(
      JSON.stringify({
        stage: "coupon_list_failed",
        route: ROUTE_NAME,
        requestId: ops.requestId,
        supabase: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      }),
    );

    return jsonErrorWithRequestId("INTERNAL_ERROR", "unexpected", ops.requestId, 500, {
      hint: "unexpected",
    });
  }

  return jsonOkWithRequestId(
    {
      coupons:
        data?.map((row) => ({
          id: row.id,
          codeDisplay: row.code_display,
          expiresAt: row.expires_at,
          maxUses: row.max_uses,
          uses: row.uses,
          effectType: row.effect_type,
          effectValue: toNumber(row.effect_value) ?? 0,
          createdAt: row.created_at,
        })) ?? [],
    },
    ops.requestId,
  );
}

export const GET = withOps(handleGet, { log: true, errorCode: ErrorCodes.dbFailed });
