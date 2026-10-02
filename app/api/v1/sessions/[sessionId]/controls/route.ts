import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { updateSessionControls } from "@/lib/data/sessionQuestions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400, requestId?: string) {
  return NextResponse.json({ ok: false, error: { code, message }, requestId }, { status });
}

async function getSessionBoardRole(sessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("board_id")
    .eq("id", sessionId)
    .maybeSingle();

  const boardId = (session as { board_id?: string } | null)?.board_id;
  if (!boardId) return { boardId: null, role: null } as const;

  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const normalized = normalizeBoardRole(role);
  if (roleError) {
    return { boardId, role: null } as const;
  }
  return { boardId, role: normalized } as const;
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
  ops: WithOpsContext,
) {
  const { sessionId } = await params;
  if (!UUID_REGEX.test(sessionId)) {
    return jsonError("invalid_params", "세션 ID가 올바르지 않아요.", 400, ops.requestId);
  }

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401, ops.requestId);
  }

  const { boardId, role } = await getSessionBoardRole(sessionId);
  if (!boardId || !role || role === "viewer") {
    return jsonError("forbidden", "세션을 관리할 권한이 없어요.", 403, ops.requestId);
  }

  const payload = (await request.json().catch(() => null)) as
    | { questionsLocked?: boolean; helpLocked?: boolean }
    | null;

  if (!payload) {
    return jsonError("invalid_body", "요청 본문이 필요합니다.", 400, ops.requestId);
  }

  try {
    const updated = await updateSessionControls({
      sessionId,
      questionsLocked: payload.questionsLocked,
      helpLocked: payload.helpLocked,
    });
    return NextResponse.json({ ok: true, data: updated, requestId: ops.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "제어 상태를 업데이트할 수 없어요.";
    return jsonError("server_error", message, 500, ops.requestId);
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withOps(handlePost, { log: true, errorCode: "unknown" });
