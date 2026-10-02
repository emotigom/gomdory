import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { listSessions, startSession } from "@/lib/data/sessionsReport";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const { user } = await requireUserApi().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => null)) as { shareCode?: string; title?: string } | null;

  try {
    const session = await startSession({
      boardId,
      shareCode: body?.shareCode ?? null,
      title: body?.title ?? null,
      createdBy: user.id,
    });
    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "세션을 시작할 수 없습니다.";
    return jsonError("session_start_failed", message, 502);
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const requestId = getOrCreateRequestId(request);
  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const { user } = await requireUserApi().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5", 10) || 5, 25);
  const cursor = url.searchParams.get("cursor");

  try {
    const sessions = await listSessions({ boardId, limit, cursor });
    const data = { data: sessions };
    const schemaVersion = SCHEMA_VERSIONS.boardSessionsList;
    const contractHash = computeContractHash(data);
    return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "세션 목록을 불러오지 못했습니다.";
    return jsonError("session_list_failed", message, 502);
  }
}
