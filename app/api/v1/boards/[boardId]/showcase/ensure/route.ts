import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { buildShowcaseUrl } from "@/lib/http/publicLinks";
import { getRequestHost, getRequestProto } from "@/lib/http/requestHost";
import { getTeacherCanonicalOrigin, isTeacherHost } from "@/lib/http/siteConfig";
import { ensureShowcaseForBoard } from "@/lib/showcase/ensureShowcase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function isLocalHost(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
): Promise<Response> {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const { boardId } = await params;
  if (!boardId) {
    return jsonError("invalid_board_id", "보드 ID를 확인해주세요.");
  }

  const [host, proto] = await Promise.all([getRequestHost(request.headers), getRequestProto(request.headers)]);
  if (!isTeacherHost(host) && !isLocalHost(host)) {
    return jsonError("forbidden_host", "교사용 도메인에서만 생성할 수 있습니다.", 403);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonError("forbidden", "보드 접근 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => null)) as { title?: string | null } | null;

  try {
    const result = await ensureShowcaseForBoard({
      boardId,
      userId,
      title: body?.title ?? null,
    });

    const canonicalOrigin = getTeacherCanonicalOrigin(proto);
    return NextResponse.json({
      ok: true,
      showcaseId: result.showcaseId,
      token: result.token,
      url: {
        canonical: `${canonicalOrigin}/x/${result.token}`,
        short: buildShowcaseUrl(result.token, proto),
      },
      snapshotSummary: {
        metrics: result.snapshot.metrics,
      },
    });
  } catch {
    return jsonError("showcase_create_failed", "쇼케이스를 생성하지 못했습니다.", 500);
  }
}
