import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getBoardLiveSession } from "@/lib/data/liveSession";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { triageEntriesToItems } from "@/lib/triage/triageItems";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TriageItem } from "@/lib/types/triage";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_SET = new Set<TriageItem["status"]>(["pending", "approved", "hidden"]);

type TriageDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  getBoardLiveSessionFn?: typeof getBoardLiveSession;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(
  boardId: string,
  deps?: TriageDeps,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  try {
    await ensureUser();
  } catch {
    return { ok: false, response: jsonError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { ok: false, response: jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403) };
  }

  return { ok: true };
}

async function handleGet(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  _ops: WithOpsContext,
  deps?: TriageDeps,
) {
  const { boardId } = await params;
  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId, deps);
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 40) || 40, 200);

  const loadSession = deps?.getBoardLiveSessionFn ?? getBoardLiveSession;
  const session = await loadSession(boardId);
  const triageEntries = session?.snapshot?.studentActionTriage?.actions ?? [];
  const items = triageEntriesToItems(triageEntries, boardId);

  const filtered = statusParam && STATUS_SET.has(statusParam as TriageItem["status"])
    ? items.filter((item) => item.status === statusParam)
    : items;

  return {
    items: filtered.slice(0, limit),
  };
}

export const GET = withOps(handleGet, { log: true, errorCode: "unknown" });
