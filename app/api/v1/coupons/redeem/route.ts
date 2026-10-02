export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { hashCouponCode, normalizeCouponCode } from "@/lib/coupons/code";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { toCamelKeys, toSnakeKeys } from "@/lib/standards/fields";
import { routes } from "@/lib/standards/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROUTE_NAME = routes.api.coupons.redeem();

const redeemHintMap: Record<string, string> = {
  notFound: "쿠폰을 찾을 수 없습니다.",
  expired: "만료된 쿠폰입니다.",
  usedUp: "사용 횟수가 모두 소진되었습니다.",
  alreadyRedeemed: "이미 사용한 쿠폰입니다.",
};

const toReasonKey = (reason: string | null): string => {
  if (!reason) return "";
  return reason.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
};

type RedeemPayload = {
  code: string;
};

type RedeemResult = {
  ok: boolean;
  reason: string | null;
  effectType: string | null;
  effectValue: number | string | null;
  newQuotaBytes: number | string | null;
};

const parsePayload = (value: unknown): RedeemPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const code = typeof raw.code === "string" ? raw.code : "";
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  return { code };
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
  let userId: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, {
      hint: "login required",
    });
  }

  let payload: RedeemPayload | null = null;
  try {
    payload = parsePayload(await request.json());
  } catch {
    payload = null;
  }

  if (!payload) {
    return jsonErrorWithRequestId("BAD_REQUEST", "invalid body", ops.requestId, 400, {
      hint: "invalid body",
    });
  }

  const supabase = createSupabaseServerClient();
  const codeSha256 = await hashCouponCode(payload.code);
  const rpcPayload = toSnakeKeys({ pUserId: userId, pCodeSha256: codeSha256 });
  const { data, error } = await supabase.rpc("redeem_coupon", rpcPayload).single();

  if (error || !data) {
    console.error(
      JSON.stringify({
        stage: "coupon_redeem_failed",
        route: ROUTE_NAME,
        requestId: ops.requestId,
        supabase: {
          code: error?.code ?? null,
          message: error?.message ?? null,
          details: error?.details ?? null,
          hint: error?.hint ?? null,
        },
      }),
    );

    return jsonErrorWithRequestId("INTERNAL_ERROR", "unexpected", ops.requestId, 500, {
      hint: "unexpected",
    });
  }

  const result = toCamelKeys(data as Record<string, unknown>) as RedeemResult;
  if (!result.ok) {
    if (result.reason === "unauthorized") {
      return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", ops.requestId, 401, {
        hint: "login required",
      });
    }

    const hint = redeemHintMap[toReasonKey(result.reason)] ?? "쿠폰을 적용할 수 없습니다.";
    return jsonErrorWithRequestId("COUPON_INVALID", "invalid coupon", ops.requestId, 400, { hint });
  }

  const effectValue = toNumber(result.effectValue);
  const newQuotaBytes = toNumber(result.newQuotaBytes);

  if (!result.effectType || effectValue === null) {
    return jsonErrorWithRequestId("INTERNAL_ERROR", "unexpected", ops.requestId, 500, {
      hint: "unexpected",
    });
  }

  return jsonOkWithRequestId(
    {
      effectType: result.effectType,
      effectValue,
      newQuotaBytes: newQuotaBytes ?? null,
    },
    ops.requestId,
  );
}

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
