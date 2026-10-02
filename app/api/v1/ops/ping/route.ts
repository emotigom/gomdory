import { apiV1Path } from "@/lib/standards/pathTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOperationalOk } from "@/lib/api/server/operational";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { measure } from "@/lib/ops/telemetry";

async function handleGet(_request: Request, _context: unknown, requestContext: RequestContext) {
  const route = apiV1Path("ops/ping");
  return measure(
    {
      route,
      stage: "ops_ping",
      requestId: requestContext.requestId,
      code: 200,
    },
    async () => {
      void recordOpsEvent({
        level: "info",
        kind: "smoke",
        request_id: requestContext.requestId,
        route,
        status: 200,
      });

      return jsonOperationalOk({ requestId: requestContext.requestId }, requestContext.requestId);
    },
  );
}

export const GET = withRequestContext(handleGet);
