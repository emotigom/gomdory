import { NextResponse } from "next/server";

import { readRuntimeIdentity } from "@/lib/env/runtimeIdentity";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { isEmergencyMode, isReadOnlyMode } from "@/lib/flags/emergency";
import { isWebLLMEnabled } from "@/lib/flags/featureFlags";
import { getLastErrorSummary, measure } from "@/lib/ops/telemetry";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleGet(_request: Request, _context: unknown, requestContext: RequestContext) {
  const route = apiV1Path("ops/runtime");
  return measure(
    {
      route,
      stage: "ops_runtime",
      requestId: requestContext.requestId,
      code: 200,
    },
    () => {
      const { buildId, versionId, envName } = readRuntimeIdentity();

      const response = NextResponse.json(
        {
          ok: true,
          requestId: requestContext.requestId,
          buildId,
          versionId,
          envName,
          featureFlags: {
            emergencyMode: isEmergencyMode(),
            emergencyReadOnly: isReadOnlyMode(),
            webllmEnabled: isWebLLMEnabled(),
          },
          lastError: getLastErrorSummary(),
        },
        { headers: { "cache-control": "no-store" } },
      );
      return response;
    },
  );
}

export const GET = withRequestContext(handleGet);
