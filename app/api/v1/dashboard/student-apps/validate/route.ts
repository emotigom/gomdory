import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { StudentAppDryRunBadRequestError, runStudentStaticAppDryRun } from "@/lib/student-apps/staticAppDryRun";
import { STUDENT_APP_MAX_REQUEST_CONTENT_LENGTH } from "@/lib/student-apps/fileRules";

function error(status: number, code: string, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    await requireUserApi();
  } catch {
    return error(401, "unauthorized", "로그인이 필요합니다.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (Number.isFinite(size) && size > STUDENT_APP_MAX_REQUEST_CONTENT_LENGTH) {
      return error(413, "payload_too_large", "요청 크기가 너무 큽니다. 전체 20MB 이하로 줄여 주세요.");
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_body", "요청 형식이 올바르지 않습니다.");
  }

  try {
    const result = await runStudentStaticAppDryRun(body);
    return Response.json({ ok: true, result }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof StudentAppDryRunBadRequestError) {
      const code = err.message || "invalid_body";
      const status = code.includes("exceeds_limit") || code === "payload_too_large" ? 413 : 400;
      return error(status, code, "요청 형식이 올바르지 않습니다.");
    }

    return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  }
}
