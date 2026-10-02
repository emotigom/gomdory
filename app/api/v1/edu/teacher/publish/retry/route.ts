import { NextRequest } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { handleTeacherPublishRetryRoute } from "@/lib/server/edu/teacher/handleTeacherPublishRetryRoute";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = await request.json().catch(() => null);
  return handleTeacherPublishRetryRoute({ request, requestId, payload });
}
