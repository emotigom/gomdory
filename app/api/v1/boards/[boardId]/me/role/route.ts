import { NextResponse } from "next/server";

import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  const requestId = getOrCreateRequestId(request);

  const supabase = createSupabaseServerClient();

  let userId: string;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    return jsonError("보드를 불러오지 못했습니다.", 500);
  }

  if (!board) {
    return jsonError("보드를 찾을 수 없습니다.", 404);
  }

  if (board.owner_id === userId) {
    const role: BoardRole = "owner";
    const data = { role };
    const schemaVersion = SCHEMA_VERSIONS.boardMeRole;
    const contractHash = computeContractHash(data);
    return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    return jsonError("권한을 확인하지 못했습니다.", 500);
  }

  if (!membership) {
    return jsonError("이 보드에 접근할 수 없습니다.", 403);
  }

  const data = { role: normalizeBoardRole(membership.role) };
  const schemaVersion = SCHEMA_VERSIONS.boardMeRole;
  const contractHash = computeContractHash(data);
  return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
}
