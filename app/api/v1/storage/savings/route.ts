import { apiV1Path } from "@/lib/standards/pathTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getStorageSavingsForOwner } from "@/lib/data/storageSavings.server";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { logWithContext } from "@/lib/ops/logWithContext";

const ROUTE_NAME = apiV1Path("storage/savings");

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  getStorageSavingsForOwnerFn?: typeof getStorageSavingsForOwner;
};

async function handleGet(
  request: NextRequest,
  _context: unknown,
  requestContext: RequestContext,
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const fetchSavings = deps?.getStorageSavingsForOwnerFn ?? getStorageSavingsForOwner;

  const respond = (response: Response, context?: Record<string, unknown>) => {
    response.headers.set("cache-control", "no-store");
    logWithContext({
      level: response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info",
      stage: "storage_savings",
      requestId: requestContext.requestId,
      route: request.nextUrl.pathname,
      status: response.status,
      meta: context ?? null,
    });
    return response;
  };

  let userId: string | null = null;

  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return respond(jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId: requestContext.requestId }), {
      code: "unauthorized",
      route: ROUTE_NAME,
    });
  }

  if (!userId) {
    return respond(jsonError("unauthorized", "로그인이 필요합니다.", 401, { requestId: requestContext.requestId }), {
      code: "unauthorized",
      route: ROUTE_NAME,
    });
  }

  try {
    const savings = await fetchSavings(userId);
    return respond(jsonOk({ ...savings }), { code: "ok", route: ROUTE_NAME });
  } catch (error) {
    const supabaseErrorCode =
      typeof error === "object" && error && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    return respond(
      jsonError(
        "storage_savings_failed",
        "절감 지표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        502,
        { requestId: requestContext.requestId },
      ),
      { code: "storage_savings_failed", supabaseErrorCode, route: ROUTE_NAME },
    );
  }
}

export const GET = withRequestContext(handleGet);
