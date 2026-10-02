import "server-only";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getNotFoundSpikeSummary } from "@/lib/ops/notFoundSpike";
import { CANONICAL_HOST } from "@/lib/http/siteConfig";

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const init = withNoStoreHeaders({});

  let email: string | null = null;
  try {
    const { user } = await requireUserApi();
    email = user.email ?? null;
  } catch {
    return jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401, undefined, init);
  }

  if (!isOpsAdmin(email)) {
    return jsonErrorWithRequestId("forbidden", "운영자 권한이 필요합니다.", requestId, 403, undefined, init);
  }

  const summary = await getNotFoundSpikeSummary({ canonicalHost: CANONICAL_HOST });

  return jsonOkWithRequestId(
    {
      summary,
    },
    requestId,
    init,
  );
}
