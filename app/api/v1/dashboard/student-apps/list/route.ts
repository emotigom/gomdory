import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listStudentAppDeployments } from "@/lib/student-apps/listStudentAppDeployments";

const error = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  let userId = "";
  try {
    userId = (await requireUserApi()).user.id;
  } catch {
    return error(401, "unauthorized", "로그인이 필요합니다.");
  }

  const boardId = request.nextUrl.searchParams.get("boardId")?.trim();
  if (!boardId) return error(400, "board_id_required", "boardId가 필요합니다.");

  const rawLimit = request.nextUrl.searchParams.get("limit");
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;

  try {
    const result = await listStudentAppDeployments({
      supabase: createSupabaseAdminClient() as unknown as Parameters<typeof listStudentAppDeployments>[0]["supabase"],
      userId,
      boardId,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return Response.json(result, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "forbidden_board") return error(403, "forbidden_board", "보드 접근 권한이 없습니다.");
    if (code === "storage_schema_unavailable") return error(503, "storage_schema_unavailable", "저장소 스키마를 사용할 수 없습니다.");
    return error(500, "internal_error", "요청을 처리하지 못했습니다.");
  }
}
