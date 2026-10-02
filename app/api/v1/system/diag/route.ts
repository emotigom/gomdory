export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOperationalError, jsonOperationalOk } from "@/lib/api/server/operational";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { buildSystemDiagResponse } from "@/lib/system/diag/runtimeSummary";

async function handleGet(request: Request, _context: unknown, requestContext: RequestContext) {
  const responseBody = await buildSystemDiagResponse(request, requestContext.requestId);

  if (!responseBody.ok) {
    return jsonOperationalError(responseBody.code, responseBody.message, requestContext.requestId, 500);
  }

  return jsonOperationalOk(responseBody, requestContext.requestId);
}

export const GET = withRequestContext(handleGet);
