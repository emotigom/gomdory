import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createBookmark, listBookmarks } from "@/lib/data/sessionBookmarks";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(boardId: string) {
  const { user } = await requireUserApi().catch(() => ({ user: null }));
  if (!user) {
    return { ok: false as const, response: jsonError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { ok: false as const, response: jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403) };
  }

  return { ok: true as const };
}

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string; sessionId: string }> }) {
  const { boardId, sessionId } = await params;

  if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(sessionId)) {
    return jsonError("invalid_id", "ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;

  try {
    const items = await listBookmarks(sessionId);
    return NextResponse.json({ ok: true, data: { items } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "북마크를 불러오지 못했습니다.";
    return jsonError("bookmark_fetch_failed", message, 502);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string; sessionId: string }> }) {
  const { boardId, sessionId } = await params;

  if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(sessionId)) {
    return jsonError("invalid_id", "ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => null)) as { note?: unknown } | null;

  try {
    const item = await createBookmark({ boardId, sessionId, note: body?.note });
    return NextResponse.json({ ok: true, data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "북마크를 저장하지 못했습니다.";
    return jsonError("bookmark_create_failed", message, 502);
  }
}
