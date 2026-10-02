import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClearPayload = {
  boardId?: string;
};

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as ClearPayload | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = typeof payload.boardId === "string" ? payload.boardId.trim() : "";
  if (!boardId) {
    return jsonErrorWithRequestId(
      "MISSING_BOARD_ID",
      "boardId is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "보드를 확인하지 못했습니다.",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (boardRole === "viewer") {
    return jsonErrorWithRequestId(
      "FORBIDDEN",
      "이 보드에 접근할 수 없습니다.",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("edu_broadcasts")
    .select("version")
    .eq("board_id", boardId)
    .maybeSingle<{ version: number }>();

  const nextVersion = (existing?.version ?? 0) + 1;
  const now = new Date().toISOString();

  const { error } = await supabase.from("edu_broadcasts").upsert(
    {
      board_id: boardId,
      message: null,
      cta_type: null,
      cta_label: null,
      version: nextVersion,
      updated_at: now,
      updated_by: userId,
    },
    { onConflict: "board_id" },
  );

  if (error) {
    void recordOpsEvent(
      toSnakeKeys({
        level: "error",
        kind: "api_error",
        requestId,
        route: request.nextUrl.pathname,
        status: 500,
        meta: {
          stage: "edu_broadcast",
          action: "clear_failed",
          boardId,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );
    return jsonErrorWithRequestId("CLEAR_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ ok: true, version: nextVersion }, requestId, withNoStoreHeaders());
}
