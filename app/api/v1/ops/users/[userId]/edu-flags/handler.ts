import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireOpsAdmin } from "@/lib/auth/requireOpsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { recordAuditEvent } from "@/lib/data/auditEvents";
import {
  normalizeOpsFeatureFlags,
  resolveOpsFeatureFlagGating,
  type OpsFeatureFlags,
} from "@/lib/ops/eduFeatureFlagsAdmin";
import type { WithOpsContext } from "@/lib/ops/withOps";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getEduFeatureFlagsByUserId,
  mapApiModeToDbMode,
  mapApiTierToDbTier,
  normalizeEduFlagsUpdatePayload,
  upsertEduFeatureFlagsByUserId,
} from "@/lib/ops/eduFeatureFlagsStore";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 30;

type Context = { params: Promise<{ userId: string }> };


type Dependencies = {
  requireOpsAdminFn?: typeof requireOpsAdmin;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

function parseUserId(params: { userId?: string }) {
  const userId = params.userId?.trim();
  return userId ? userId : null;
}

async function getTargetUserEmail(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}

async function enforceOpsRateLimit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  actorUserId: string,
  method: string,
  targetUserId: string,
) {
  return checkRateLimit(admin as unknown as Parameters<typeof checkRateLimit>[0], {
    key: `ops:edu-flags:${method}:${actorUserId}:${targetUserId}`,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    limit: RATE_LIMIT_MAX,
  });
}

export async function handleOpsUserEduFlagsGet(
  request: NextRequest,
  context: Context,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureOpsAdmin = deps?.requireOpsAdminFn ?? requireOpsAdmin;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  let auth;
  try {
    auth = await ensureOpsAdmin(requireUserApi);
  } catch (error) {
    const status = (error as { code?: string }).code === "forbidden" ? 403 : 401;
    return jsonErrorWithRequestId(
      status === 403 ? "forbidden" : "unauthorized",
      status === 403 ? "운영자 권한이 필요합니다." : "로그인이 필요합니다.",
      ops.requestId,
      status,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const userId = parseUserId(await context.params);
  if (!userId) {
    return jsonErrorWithRequestId("invalidRequest", "userId가 필요합니다.", ops.requestId, 400, undefined, withNoStoreHeaders());
  }

  const admin = createAdminClient();
  const rate = await enforceOpsRateLimit(admin, auth.user.id, request.method, userId);
  if (!rate.ok) {
    return jsonErrorWithRequestId("rateLimited", "요청이 너무 많습니다.", ops.requestId, 429, undefined, withNoStoreHeaders());
  }

  const email = await getTargetUserEmail(admin, userId);
  const { data, error } = await getEduFeatureFlagsByUserId(admin, userId);

  if (error) {
    return jsonErrorWithRequestId(
      "featureFlagsFailed",
      "기능 플래그를 불러오지 못했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const row = data ?? null;
  const featureFlags = normalizeOpsFeatureFlags(row, row?.updated_at ?? null);
  const gating = resolveOpsFeatureFlagGating({
    userId,
    email,
    featureFlags,
    userFlagsPresent: Boolean(row),
  });

  return jsonOkWithRequestId(
    { user: { id: userId, email }, featureFlags, gating },
    ops.requestId,
    withNoStoreHeaders(),
  );
}

function parseUpdatePayload(payload: unknown): OpsFeatureFlags | null {
  const normalized = normalizeEduFlagsUpdatePayload(payload);
  if (!normalized) return null;
  return { ...normalized, updatedAt: null };
}

export async function handleOpsUserEduFlagsPost(
  request: NextRequest,
  context: Context,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureOpsAdmin = deps?.requireOpsAdminFn ?? requireOpsAdmin;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  let auth;
  try {
    auth = await ensureOpsAdmin(requireUserApi);
  } catch (error) {
    const status = (error as { code?: string }).code === "forbidden" ? 403 : 401;
    return jsonErrorWithRequestId(
      status === 403 ? "forbidden" : "unauthorized",
      status === 403 ? "운영자 권한이 필요합니다." : "로그인이 필요합니다.",
      ops.requestId,
      status,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const userId = parseUserId(await context.params);
  if (!userId) {
    return jsonErrorWithRequestId("invalidRequest", "userId가 필요합니다.", ops.requestId, 400, undefined, withNoStoreHeaders());
  }

  const parsed = parseUpdatePayload(await request.json().catch(() => null));
  if (!parsed) {
    return jsonErrorWithRequestId("invalidRequest", "요청 본문이 올바르지 않습니다.", ops.requestId, 400, undefined, withNoStoreHeaders());
  }

  const admin = createAdminClient();
  const rate = await enforceOpsRateLimit(admin, auth.user.id, request.method, userId);
  if (!rate.ok) {
    return jsonErrorWithRequestId("rateLimited", "요청이 너무 많습니다.", ops.requestId, 429, undefined, withNoStoreHeaders());
  }

  const { data, error } = await upsertEduFeatureFlagsByUserId(admin, userId, {
    webllmEnabled: parsed.webllmEnabled,
    netsaverEnabled: parsed.netsaverEnabled,
    netsaverMode: mapApiModeToDbMode(parsed.netsaverMode),
    netsaverP2pTier: mapApiTierToDbTier(parsed.netsaverP2pTier),
    maxBytes: parsed.maxBytes,
  });

  if (error || !data) {
    return jsonErrorWithRequestId(
      "featureFlagsUpdateFailed",
      "기능 플래그 저장에 실패했습니다.",
      ops.requestId,
      502,
      undefined,
      withNoStoreHeaders(),
    );
  }

  void recordAuditEvent({
    actorUserId: auth.user.id,
    action: "opsEduFeatureFlagsUpdated",
    targetType: "user",
    targetId: userId,
    requestId: ops.requestId,
    host: request.headers.get("host"),
    meta: {
      webllmEnabled: parsed.webllmEnabled,
      netsaverEnabled: parsed.netsaverEnabled,
      netsaverMode: parsed.netsaverMode,
      netsaverP2pTier: parsed.netsaverP2pTier,
      maxBytes: parsed.maxBytes,
    },
  });

  const email = await getTargetUserEmail(admin, userId);
  const featureFlags = normalizeOpsFeatureFlags(data, data.updated_at ?? null);
  const gating = resolveOpsFeatureFlagGating({
    userId,
    email,
    featureFlags,
    userFlagsPresent: true,
  });

  return jsonOkWithRequestId(
    { user: { id: userId, email }, featureFlags, gating },
    ops.requestId,
    withNoStoreHeaders(),
  );
}
