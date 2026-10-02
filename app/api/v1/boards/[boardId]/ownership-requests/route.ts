import { NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withOps } from "@/lib/ops/withOps";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_SET = new Set(["pending", "approved", "rejected"]);

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(boardId: string) {
  try {
    await requireUserApi();
  } catch {
    return { ok: false as const, response: jsonError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !canEditBoard(boardRole)) {
    return { ok: false as const, response: jsonError("forbidden", "보드 접근 권한이 없습니다.", 403) };
  }

  return { ok: true as const };
}

async function handleGet(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;
  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") ?? "pending";
  const status = STATUS_SET.has(statusParam) ? statusParam : "pending";
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("ownership_requests")
    .select(
      "id, student_name, new_client_id, status, created_at, approved_at, approved_card_count",
    )
    .eq("board_id", boardId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonError("query_failed", "소유권 요청을 불러오지 못했습니다.", 500);
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    studentName: row.student_name,
    clientId: row.new_client_id,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedCardCount: row.approved_card_count,
  }));

  return { items };
}

export const GET = withOps(handleGet, { log: true, errorCode: "unknown" });
