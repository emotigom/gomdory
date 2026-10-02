import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { logAudit } from "@/lib/data/audit";
import { getBoardPolicy } from "@/lib/data/boardPolicies";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PatchBody = Partial<{ editorsCanSoftDelete: unknown; editorsCanManageTrash: unknown }>;

type PolicyResponse = {
  ok: true;
  policy: {
    editorsCanSoftDelete: boolean;
    editorsCanManageTrash: boolean;
  };
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
): Promise<Response> {
  const { boardId } = await params;
  const requestId = getOrCreateRequestId(request);

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 400);
  }

  if (!boardRole) {
    return jsonError("forbidden", "보드 접근 권한이 없습니다.", 403);
  }

  const policy = await getBoardPolicy(boardId, supabase);

  const response: PolicyResponse = {
    ok: true,
    policy,
  };

  const data = { policy: response.policy };
  const schemaVersion = SCHEMA_VERSIONS.boardPolicy;
  const contractHash = computeContractHash(data);
  return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
}

function normalizePatch(body: PatchBody):
  | { editorsCanSoftDelete?: boolean; editorsCanManageTrash?: boolean }
  | null {
  const result: { editorsCanSoftDelete?: boolean; editorsCanManageTrash?: boolean } = {};

  if ("editorsCanSoftDelete" in body) {
    if (typeof body.editorsCanSoftDelete !== "boolean") {
      return null;
    }
    result.editorsCanSoftDelete = body.editorsCanSoftDelete;
  }

  if ("editorsCanManageTrash" in body) {
    if (typeof body.editorsCanManageTrash !== "boolean") {
      return null;
    }
    result.editorsCanManageTrash = body.editorsCanManageTrash;
  }

  return result;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
): Promise<Response> {
  const { boardId } = await params;
  const { user } = await requireUserApi();

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 400);
  }

  if (boardRole !== "owner") {
    return jsonError("forbidden", "정책을 변경할 권한이 없습니다.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const patch = normalizePatch(body);

  if (!patch || Object.keys(patch).length === 0) {
    return jsonError("invalid_payload", "변경할 정책 값을 확인해주세요.");
  }

  const current = await getBoardPolicy(boardId, supabase);
  const nextPolicy = {
    editorsCanSoftDelete: patch.editorsCanSoftDelete ?? current.editorsCanSoftDelete,
    editorsCanManageTrash: patch.editorsCanManageTrash ?? current.editorsCanManageTrash,
  };

  const { error: upsertError } = await supabase.from("board_policies").upsert(
    {
      board_id: boardId,
      editors_can_soft_delete: nextPolicy.editorsCanSoftDelete,
      editors_can_manage_trash: nextPolicy.editorsCanManageTrash,
      updated_by: user.id,
    },
    { onConflict: "board_id" },
  );

  if (upsertError) {
    return jsonError("update_failed", upsertError.message, 400);
  }

  await logAudit({
    boardId,
    action: "board.policy.update",
    targetType: "board",
    targetId: boardId,
    meta: nextPolicy,
  });

  const response: PolicyResponse = {
    ok: true,
    policy: nextPolicy,
  };

  return NextResponse.json(response);
}
