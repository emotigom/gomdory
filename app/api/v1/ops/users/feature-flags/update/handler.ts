import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireOpsAdmin } from "@/lib/auth/requireOpsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import type { WithOpsContext } from "@/lib/ops/withOps";
import {
  mapApiModeToDbMode,
  mapApiTierToDbTier,
  normalizeEduFlagsUpdatePayload,
  toEduFeatureFlagsDto,
  upsertEduFeatureFlagsByUserId,
} from "@/lib/ops/eduFeatureFlagsStore";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Dependencies = {
  requireOpsAdminFn?: typeof requireOpsAdmin;
  createAdminClientFn?: typeof createSupabaseAdminClient;
};

export async function handleFeatureFlagsUpdate(
  request: NextRequest,
  _context: unknown,
  ops: WithOpsContext,
  deps?: Dependencies,
) {
  const ensureOpsAdmin = deps?.requireOpsAdminFn ?? requireOpsAdmin;
  const createAdminClient = deps?.createAdminClientFn ?? createSupabaseAdminClient;

  try {
    await ensureOpsAdmin(requireUserApi);
  } catch (error) {
    const status = (error as { code?: string }).code === "forbidden" ? 403 : 401;
    const code = status === 403 ? "forbidden" : "unauthorized";
    const message = status === 403 ? "운영자 권한이 필요합니다." : "로그인이 필요합니다.";

    return jsonErrorWithRequestId(code, message, ops.requestId, status, undefined, withNoStoreHeaders());
  }

  const parsed = normalizeEduFlagsUpdatePayload(await request.json().catch(() => null));
  if (!parsed?.userId) {
    return jsonErrorWithRequestId("invalidRequest", "userId가 필요합니다.", ops.requestId, 400, undefined, withNoStoreHeaders());
  }

  const admin = createAdminClient();
  const { data, error } = await upsertEduFeatureFlagsByUserId(admin, parsed.userId, {
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

  return jsonOkWithRequestId({ featureFlags: toEduFeatureFlagsDto(data) }, ops.requestId, withNoStoreHeaders());
}
