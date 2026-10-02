export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { hashCouponCode, normalizeCouponCode } from "@/lib/coupons/code";
import { ErrorCodes } from "@/lib/ops/errors";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { toSnakeKeys } from "@/lib/standards/fields";
import { routes } from "@/lib/standards/routes";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

const ROUTE_NAME = routes.api.opsAdmin.coupons.create();

const EFFECT_TYPES = new Set(["quota_bonus_bytes", "discount_won", "discount_percent"]);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

type CreateCouponPayload = {
  code: string;
  expiresAt: string | null;
  maxUses: number;
  effectType: string;
  effectValue: number;
  note: string | null;
};

const parsePayload = (value: unknown): CreateCouponPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const code = typeof raw.code === "string" ? raw.code : "";
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;

  const expiresRaw = typeof raw.expiresAt === "string" ? raw.expiresAt : "";
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresRaw && (!expiresAt || Number.isNaN(expiresAt.valueOf()))) return null;

  const maxUses = typeof raw.maxUses === "number" ? raw.maxUses : Number(raw.maxUses);
  if (!Number.isFinite(maxUses) || maxUses <= 0) return null;

  const effectType = typeof raw.effectType === "string" ? raw.effectType : "";
  if (!EFFECT_TYPES.has(effectType)) return null;

  const effectValue = typeof raw.effectValue === "number" ? raw.effectValue : Number(raw.effectValue);
  if (!Number.isFinite(effectValue) || effectValue <= 0) return null;

  const note = typeof raw.note === "string" ? raw.note.trim() : "";

  return {
    code,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    maxUses: Math.floor(maxUses),
    effectType,
    effectValue: Math.round(effectValue),
    note: note.length > 0 ? note : null,
  };
};

async function handlePost(request: NextRequest, _context: unknown, ops: WithOpsContext) {
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

  let payload: CreateCouponPayload | null = null;
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

  const admin = createSupabaseAdminClient();
  const codeSha256 = await hashCouponCode(payload.code);
  const codeDisplay = normalizeCouponCode(payload.code);

  const insertPayload = toSnakeKeys({
    codeSha256,
    codeDisplay,
    expiresAt: payload.expiresAt,
    maxUses: payload.maxUses,
    uses: 0,
    effectType: payload.effectType,
    effectValue: payload.effectValue,
    note: payload.note,
  }) as Database["public"]["Tables"]["coupon_codes"]["Insert"];

  const { data, error } = await admin
    .from("coupon_codes")
    .insert(insertPayload)
    .select("id, code_display, expires_at, max_uses, uses, effect_type, effect_value, created_at")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return jsonErrorWithRequestId("COUPON_DUPLICATE", "duplicate", ops.requestId, 409, {
        hint: "already exists",
      });
    }

    console.error(
      JSON.stringify({
        stage: "coupon_create_failed",
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

  return jsonOkWithRequestId(
    {
      id: data.id,
      codeDisplay: data.code_display,
      expiresAt: data.expires_at,
      maxUses: data.max_uses,
      uses: data.uses,
      effectType: data.effect_type,
      effectValue: toNumber(data.effect_value) ?? 0,
      createdAt: data.created_at,
    },
    ops.requestId,
  );
}

export const POST = withOps(handlePost, { log: true, errorCode: ErrorCodes.dbFailed });
