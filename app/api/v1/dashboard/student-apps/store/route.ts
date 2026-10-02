import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getEduBucketFromRuntimeEnv } from "@/lib/cloudflare/getCloudflareRuntimeEnv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StudentAppDryRunBadRequestError } from "@/lib/student-apps/staticAppDryRun";
import { storeStudentAppDeployment } from "@/lib/student-apps/storeStudentAppDeployment";

const MAX_REQUEST_CONTENT_LENGTH = 15 * 1024 * 1024;
const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: NextRequest) {
  let userId = "";
  try {
    userId = (await requireUserApi()).user.id;
  } catch {
    return error(401, "unauthorized", "로그인이 필요합니다.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_REQUEST_CONTENT_LENGTH) {
    return error(413, "payload_too_large", "요청 크기가 너무 큽니다. 15MB 이하로 줄여 주세요.");
  }

  const eduBucket = getEduBucketFromRuntimeEnv();
  if (!eduBucket) return error(503, "storage_unavailable", "저장소를 사용할 수 없습니다.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_body", "요청 형식이 올바르지 않습니다.");
  }
  if (!body || typeof body !== "object" || !("boardId" in body) || typeof body.boardId !== "string") {
    return error(400, "board_id_required", "boardId가 필요합니다.");
  }
  if (!("source" in body) || (body as { source?: unknown }).source !== "manual_files") {
    return error(400, "invalid_source", "현재 지원 형식은 수동 파일 업로드(manual_files) 기반 HTML/CSS/JS 정적 웹앱입니다.");
  }

  const payload = body as { boardId: string; wallId?: string | null; cardId?: string | null; classId?: string | null };

  try {
    const result = await storeStudentAppDeployment({
      bucket: eduBucket,
      supabase: createSupabaseAdminClient() as unknown as Parameters<typeof storeStudentAppDeployment>[0]["supabase"],
      userId,
      boardId: payload.boardId,
      wallId: payload.wallId ?? null,
      cardId: payload.cardId ?? null,
      classId: payload.classId ?? null,
      rawPayload: payload,
    });
    return Response.json(result, { status: result.ok ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof StudentAppDryRunBadRequestError) return error(400, err.message || "invalid_body", "요청 형식이 올바르지 않습니다.");
    const code = (err as { code?: string })?.code;
    if (code === "forbidden_board") return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");
    if (code === "storage_schema_unavailable") return error(503, "storage_schema_unavailable", "저장소 스키마를 사용할 수 없습니다.");
    return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  }
}
