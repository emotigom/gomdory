import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { ensureShowcaseForBoard } from "@/lib/showcase/ensureShowcase";
import { buildShowcaseUrl } from "@/lib/http/publicLinks";
import { getRequestProto } from "@/lib/http/requestHost";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EnsureShowcaseResponse = {
  ok: true;
  token: string;
  url: string;
  status: "active" | "revoked";
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }
  const body = (await request.json().catch(() => null)) as { boardId?: string; title?: string | null } | null;
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

  try {
    const result = await ensureShowcaseForBoard({
      boardId,
      userId,
      title: body?.title ?? null,
    });

    const proto = await getRequestProto(request.headers);
    const response: EnsureShowcaseResponse = {
      ok: true,
      token: result.token,
      url: buildShowcaseUrl(result.token, proto),
      status: "active",
    };
    return NextResponse.json(response);
  } catch {
    return jsonError("showcase_summary_failed", "쇼케이스 요약 생성에 실패했습니다.", 500);
  }
}
