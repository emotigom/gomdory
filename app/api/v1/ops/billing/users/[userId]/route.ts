import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

type Params = { userId: string };

function normalizeExpiresAt(value: unknown) {
  if (typeof value !== "string") return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

async function handleGet(_request: Request, { params }: { params: Promise<Params> }, ops: WithOpsContext) {
  const { user } = await requireUserApi();
  if (!isOpsAdmin(user.email)) {
    return jsonError("forbidden", "권한이 없습니다.", 403, { requestId: ops.requestId });
  }

  const { userId } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_plans")
    .select("user_id, plan, expires_at, note, updated_at, started_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return jsonError("plan_lookup_failed", "플랜을 불러오지 못했습니다.", 502, { requestId: ops.requestId });
  }

  if (!data) {
    return jsonOk({
      userId,
      plan: "free",
      expiresAt: null,
      note: "",
      updatedAt: null,
      startedAt: null,
      requestId: ops.requestId,
    });
  }

  return jsonOk({
    userId: data.user_id,
    plan: data.plan,
    expiresAt: data.expires_at,
    note: data.note,
    updatedAt: data.updated_at,
    startedAt: data.started_at,
    requestId: ops.requestId,
  });
}

async function handlePatch(
  request: Request,
  { params }: { params: Promise<Params> },
  ops: WithOpsContext,
) {
  const { user } = await requireUserApi();
  if (!isOpsAdmin(user.email)) {
    return jsonError("forbidden", "권한이 없습니다.", 403, { requestId: ops.requestId });
  }

  const { userId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    expiresAt?: string | null;
    note?: string;
  };

  const plan = body.plan === "pro" ? "pro" : body.plan === "free" ? "free" : null;
  if (!plan) {
    return jsonError("invalid_plan", "plan은 free 또는 pro 이어야 합니다.", 400, { requestId: ops.requestId });
  }

  const expiresAt = normalizeExpiresAt(body.expiresAt ?? null);
  const note = typeof body.note === "string" ? body.note.slice(0, 400) : "";

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_plans")
    .upsert(
      {
        user_id: userId,
        plan,
        expires_at: expiresAt,
        source: "manual",
        note,
      },
      { onConflict: "user_id" },
    )
    .select("user_id, plan, expires_at, note, updated_at, started_at")
    .single();

  if (error || !data) {
    return jsonError("plan_update_failed", "플랜을 저장하지 못했습니다.", 502, { requestId: ops.requestId });
  }

  return jsonOk({
    userId: data.user_id,
    plan: data.plan,
    expiresAt: data.expires_at,
    note: data.note,
    updatedAt: data.updated_at,
    startedAt: data.started_at,
    requestId: ops.requestId,
  });
}

export const PATCH = withOps(handlePatch, { log: true });
export const GET = withOps(handleGet, { log: true });
