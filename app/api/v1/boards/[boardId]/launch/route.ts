import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getLaunchTargetForBoard, type LaunchMode } from "@/lib/class/launcher";
import { enableSharing } from "@/lib/data/share";
import { startSession } from "@/lib/data/sessions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_INTENTS = new Set<LaunchMode>(["class", "present", "share"]);
const VALID_SOURCES = new Set(["gallery", "dashboard"]);

type LaunchRequest = {
  intent?: LaunchMode;
  source?: "gallery" | "dashboard";
};

type LaunchDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  startSessionFn?: typeof startSession;
  enableSharingFn?: typeof enableSharing;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: LaunchDeps = {},
) {
  const { boardId } = await params;
  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const createSupabaseServerClientFn = deps.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const startSessionFn = deps.startSessionFn ?? startSession;
  const enableSharingFn = deps.enableSharingFn ?? enableSharing;

  let intent: LaunchMode = "class";

  try {
    const body = (await request.json()) as LaunchRequest | null;
    if (body?.intent && VALID_INTENTS.has(body.intent)) {
      intent = body.intent;
    }
    if (body?.source && !VALID_SOURCES.has(body.source)) {
      return jsonError("invalid_source", "요청 출처를 확인해 주세요.");
    }
  } catch {
    return jsonError("invalid_body", "요청 본문을 확인해 주세요.");
  }

  let userId: string;
  try {
    const { user } = await requireUserApiFn();
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClientFn();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "수업을 시작할 권한이 없습니다.", 403);
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, share_code, share_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError || !board) {
    return jsonError("board_not_found", "보드를 확인하지 못했습니다.", 404);
  }

  const launchTarget = getLaunchTargetForBoard({ id: boardId }, [], intent);

  let shareCode = board.share_code as string | null;

  if (launchTarget.type === "run_preset") {
    try {
      await startSessionFn(boardId, userId);
      if (!shareCode) {
        const ensured = await enableSharingFn(boardId);
        shareCode = ensured.share_code ?? null;
      }
    } catch {
      return jsonError("launch_failed", "수업 시작을 준비하지 못했습니다.", 500);
    }
  } else if (!shareCode) {
    try {
      const ensured = await enableSharingFn(boardId);
      shareCode = ensured.share_code ?? null;
    } catch {
      shareCode = shareCode ?? null;
    }
  }

  const href =
    launchTarget.type === "run_preset"
      ? `/dashboard/boards/${boardId}/board?launched=1`
      : `/dashboard/boards/${boardId}/board`;

  return NextResponse.json({
    ok: true,
    action: { type: "navigate", href },
    meta: shareCode ? { shareCode } : undefined,
  });
}
