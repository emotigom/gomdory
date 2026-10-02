import { NextRequest } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { handlePublishPrepareRoute, type PrepareBody } from "@/lib/server/edu/publish/handlePublishPrepareRoute";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as PrepareBody | null;
  return handlePublishPrepareRoute({ request, requestId, payload });
}
