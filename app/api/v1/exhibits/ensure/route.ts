import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { generateSafePayload } from "@/lib/exhibit/generateSafePayload";
import { maskExhibitToken, createExhibitToken } from "@/lib/exhibit/token";
import { buildExhibitUrl } from "@/lib/http/publicLinks";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import { getRequestProto } from "@/lib/http/requestHost";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EnsureExhibitResponse = {
  ok: true;
  exhibit: {
    id: string;
    token: string;
    urlShort: string;
    urlCanonicalManage: string;
  };
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function buildCanonicalManageUrl(boardId: string): string {
  const base = CANONICAL_BASE_URL.endsWith("/")
    ? CANONICAL_BASE_URL.slice(0, -1)
    : CANONICAL_BASE_URL;
  return `${base}/dashboard/boards/${boardId}#exhibit`;
}

export async function POST(request: Request): Promise<Response> {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json().catch(() => null)) as
    | { boardId?: string; title?: string | null; description?: string | null }
    | null;
  const boardId = body?.boardId?.trim();

  if (!boardId) {
    return jsonError("invalid_board_id", "보드 ID를 확인해주세요.");
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonError("forbidden", "보드 접근 권한이 없습니다.", 403);
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("exhibits")
    .select("id, token, status")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return jsonError("exhibit_lookup_failed", "전시 링크를 확인하지 못했습니다.", 500);
  }

  const proto = await getRequestProto(request.headers);
  if (existing && existing.status !== "revoked") {
    const response: EnsureExhibitResponse = {
      ok: true,
      exhibit: {
        id: existing.id,
        token: existing.token,
        urlShort: buildExhibitUrl(existing.token, proto),
        urlCanonicalManage: buildCanonicalManageUrl(boardId),
      },
    };
    return NextResponse.json(response);
  }

  const token = createExhibitToken();
  try {
    const payload = await generateSafePayload(boardId);
    const { data: inserted, error: insertError } = await admin
      .from("exhibits")
      .insert({
        board_id: boardId,
        owner_id: userId,
        token,
        status: "active",
        mode: "safe",
        title: body?.title?.trim() || payload.board.title,
        description: body?.description?.trim() || null,
        last_generated_at: payload.generatedAt,
      })
      .select("id, token")
      .single();

    if (insertError || !inserted) {
      return jsonError("exhibit_create_failed", "전시 링크를 생성하지 못했습니다.", 500);
    }

    const { error: versionError } = await admin.from("exhibit_versions").insert({
      exhibit_id: inserted.id,
      schema_version: payload.schemaVersion,
      payload,
    });

    if (versionError) {
      return jsonError("exhibit_version_failed", "전시 요약을 저장하지 못했습니다.", 500);
    }

    const response: EnsureExhibitResponse = {
      ok: true,
      exhibit: {
        id: inserted.id,
        token: inserted.token,
        urlShort: buildExhibitUrl(inserted.token, proto),
        urlCanonicalManage: buildCanonicalManageUrl(boardId),
      },
    };
    return NextResponse.json(response);
  } catch {
    return jsonError(
      "exhibit_payload_failed",
      `전시 요약 생성에 실패했습니다: ${maskExhibitToken(token)}`,
      500,
    );
  }
}
