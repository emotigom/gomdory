import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { decodeDeletedCardCursor, listDeletedCardsForBoard } from "@/lib/data/cards";
import { canManageTrash, getBoardPolicy } from "@/lib/data/boardPolicies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  try {
    await requireUserApi();
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("보드 권한을 확인하지 못했습니다.", 400);
  }

  if (boardRole !== "owner" && boardRole !== "editor") {
    return jsonError("휴지통을 볼 권한이 없습니다.", 403);
  }

  const policy = await getBoardPolicy(boardId, supabase);

  if (!canManageTrash(boardRole, policy)) {
    return jsonError("보드 정책으로 휴지통 접근이 차단되었습니다.", 403);
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const withinDaysParam = searchParams.get("withinDays");
  const cursorParam = searchParams.get("cursor");

  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 50;
  const cursor = decodeDeletedCardCursor(cursorParam);
  const withinDays = withinDaysParam ? Number(withinDaysParam) : undefined;

  try {
    const result = await listDeletedCardsForBoard({
      boardId,
      limit,
      cursor,
      withinDays: Number.isFinite(withinDays) ? withinDays : undefined,
    });

    return NextResponse.json({
      ok: true,
      items: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "휴지통을 불러오지 못했습니다.";
    return jsonError(message, 500);
  }
}
