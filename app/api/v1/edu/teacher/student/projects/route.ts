import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 60;

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const params = request.nextUrl.searchParams;
  const boardId = params.get("boardId")?.trim() ?? "";
  const anonId = params.get("anon")?.trim() ?? "";

  if (!boardId || !anonId) {
    return jsonErrorWithRequestId(
      "MISSING_PARAMS",
      "boardId and anon are required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "보드를 확인하지 못했습니다.", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId("FORBIDDEN", "이 보드에 접근할 수 없습니다.", requestId, 403, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("edu_projects")
    .select("slug, title, created_at, expires_at, board_id")
    .eq("board_id", boardId)
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_LIMIT);

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 400,
        meta: {
          stage: "edu_teacher_student",
          action: "fetch_failed",
          boardId,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 120 },
    );
    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const publicOrigin = readEduviewOrigin();
  const projects = (data ?? []).map((project) => ({
    title: project.title,
    slug: project.slug,
    lessonId: null,
    thumbUrl: `${publicOrigin}/v1/${project.slug}/thumb.png`,
    createdAt: project.created_at,
    expiresAt: project.expires_at,
    boardId: project.board_id,
  }));

  return jsonOkWithRequestId({ projects }, requestId, withNoStoreHeaders());
}
