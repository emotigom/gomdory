import { NextRequest } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { handleTeacherPublishQuotaResetRoute, type ResetBody } from "@/lib/server/edu/teacher/handleTeacherPublishQuotaResetRoute";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as ResetBody | null;
  return handleTeacherPublishQuotaResetRoute({ requestId, payload });
}
