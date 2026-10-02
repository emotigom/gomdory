import { NextRequest } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { handlePublishRetryRoute } from "@/lib/server/edu/publish/handlePublishRetryRoute";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = await request.json().catch(() => null);
  return handlePublishRetryRoute({ request, requestId, payload });
}
