export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getStorageSummaryForOwner } from "@/lib/data/storageSummary.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const log = (status: number, context?: Record<string, unknown>) => {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    console.log(
      JSON.stringify(
        {
          level,
          route: request.nextUrl.pathname,
          method: request.method,
          status,
          requestId,
          ...(context ?? {}),
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  };

  const respond = (response: Response, context?: Record<string, unknown>) => {
    const withId = withRequestId(response, requestId);
    log(withId.status, context);
    return withId;
  };

  let userId: string | null = null;

  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return respond(jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId }), {
      code: "unauthorized",
      hint: "supabase_auth_failed",
    });
  }

  if (!userId) {
    return respond(jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId }), {
      code: "unauthorized",
      hint: "missing_user_id",
    });
  }

  try {
    const summary = await getStorageSummaryForOwner(userId);
    return respond(jsonOk({ summary }), { code: "ok" });
  } catch (error) {
    const supabaseErrorCode =
      typeof error === "object" && error && "code" in error && typeof (error as { code?: string }).code === "string"
        ? (error as { code?: string }).code
        : undefined;

    return respond(
      jsonError(
        "storage_summary_failed",
        "저장소 요약을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        502,
        { requestId },
      ),
      { code: "storage_summary_failed", supabaseErrorCode },
    );
  }
}
