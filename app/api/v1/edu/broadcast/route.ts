import { NextRequest } from "next/server";

import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  normalizeBroadcastCtaLabel,
  normalizeBroadcastCtaType,
  normalizeBroadcastMessage,
} from "@/lib/edu/broadcast/sanitizeBroadcast";

type BroadcastPayload = {
  boardId?: string;
  message?: string | null;
  ctaType?: string | null;
  ctaLabel?: string | null;
};

type BroadcastRow = Database["public"]["Tables"]["edu_broadcasts"]["Row"];

function mapBroadcast(row: BroadcastRow | null) {
  if (!row || !row.message) return null;
  return {
    message: row.message,
    ctaType: row.cta_type,
    ctaLabel: row.cta_label,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

async function requireBoardAccess(boardId: string, requestId: string) {
  try {
    const { user } = await requireUserApi();
    const supabaseServer = createSupabaseServerClient();
    const { data: role, error: roleError } = await supabaseServer.rpc("board_role", { bid: boardId });
    const boardRole = normalizeBoardRole(role);

    if (roleError || !boardRole) {
      return {
        ok: false as const,
        response: jsonErrorWithRequestId(
          "BOARD_NOT_FOUND",
          "보드를 확인하지 못했습니다.",
          requestId,
          404,
          undefined,
          withNoStoreHeaders(),
        ),
      };
    }

    if (boardRole === "viewer") {
      return {
        ok: false as const,
        response: jsonErrorWithRequestId(
          "FORBIDDEN",
          "이 보드에 접근할 수 없습니다.",
          requestId,
          403,
          undefined,
          withNoStoreHeaders(),
        ),
      };
    }

    return { ok: true as const, user };
  } catch {
    return {
      ok: false as const,
      response: jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders()),
    };
  }
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";

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

  const access = await requireBoardAccess(boardId, requestId);
  if (!access.ok) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("edu_broadcasts")
    .select("board_id, message, cta_type, cta_label, updated_at, updated_by, version")
    .eq("board_id", boardId)
    .maybeSingle();

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
          action: "get_failed",
          boardId,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );
    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ broadcast: mapBroadcast(data) }, requestId, withNoStoreHeaders());
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as BroadcastPayload | null;

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

  const access = await requireBoardAccess(boardId, requestId);
  if (!access.ok) {
    return access.response;
  }

  const message = normalizeBroadcastMessage(payload.message ?? "");
  if (!message) {
    return jsonErrorWithRequestId(
      "INVALID_MESSAGE",
      "message is required",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const ctaType = normalizeBroadcastCtaType(payload.ctaType ?? null);
  if (payload.ctaType && !ctaType) {
    return jsonErrorWithRequestId(
      "INVALID_CTA_TYPE",
      "ctaType is invalid",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const normalizedCtaType = ctaType === "none" ? null : ctaType;
  const ctaLabel = normalizedCtaType ? normalizeBroadcastCtaLabel(payload.ctaLabel ?? null) : null;

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
      message,
      cta_type: normalizedCtaType,
      cta_label: ctaLabel,
      version: nextVersion,
      updated_at: now,
      updated_by: access.user.id,
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
          action: "upsert_failed",
          boardId,
          message: error.message,
          result: "failed",
        },
      }) as Parameters<typeof recordOpsEvent>[0],
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );
    return jsonErrorWithRequestId("SAVE_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ ok: true, version: nextVersion }, requestId, withNoStoreHeaders());
}
