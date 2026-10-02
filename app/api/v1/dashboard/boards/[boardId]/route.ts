export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { normalizeBoardSummary } from "@/lib/data/boards";
import { deleteBoard, updateBoard } from "@/lib/data/boards.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

function createLogger(request: NextRequest, requestId: string) {
  return (status: number, context?: Record<string, unknown>) => {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    console.log(
      JSON.stringify(
        {
          level,
          route: request.nextUrl.pathname,
          method: request.method,
          status,
          requestId,
          ...(context ?? {}),
        },
        (_key, value) => (value === undefined ? undefined : value),
      ),
    );
  };
}

function createResponder(log: ReturnType<typeof createLogger>, requestId: string) {
  return (response: Response, context?: Record<string, unknown>) => {
    const withId = withRequestId(response, requestId);
    log(withId.status, context);
    return withId;
  };
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  const log = createLogger(request, requestId);
  const respond = createResponder(log, requestId);

  const envValidation = validateSupabaseEnv();

  if (!envValidation.ok) {
    return respond(
      jsonError(
        "supabase_env_missing",
        "보드를 삭제할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        500,
        { hint: "supabase_env_missing", requestId },
      ),
      { code: "supabase_env_missing", hint: "supabase_env_missing" },
    );
  }

  const { boardId } = await params;

  if (!boardId || typeof boardId !== "string") {
    return respond(
      jsonError("invalid_board", "보드 정보를 확인해주세요.", 400, { hint: "invalid_board_id", requestId }),
      { code: "invalid_board", hint: "invalid_board_id" },
    );
  }

  let userId: string | null = null;

  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return respond(
      jsonError("unauthorized", "로그인이 필요합니다.", 401, {
        hint: "supabase_auth_failed",
        requestId,
      }),
      { code: "unauthorized", hint: "supabase_auth_failed" },
    );
  }

  try {
    await deleteBoard({ boardId, ownerId: userId ?? "" });
    void logAudit({
      boardId,
      action: "board.deleted",
      targetType: "board",
      targetId: boardId,
    });
    return respond(jsonOk({ ok: true }), { code: "board_deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드를 삭제하지 못했습니다.";

    return respond(
      jsonError("board_delete_failed", message, 500, { hint: "unexpected", requestId }),
      { code: "board_delete_failed", hint: "unexpected" },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  const log = createLogger(request, requestId);
  const respond = createResponder(log, requestId);

  const envValidation = validateSupabaseEnv();

  if (!envValidation.ok) {
    return respond(
      jsonError(
        "supabase_env_missing",
        "보드를 수정할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        500,
        { hint: "supabase_env_missing", requestId },
      ),
      { code: "supabase_env_missing", hint: "supabase_env_missing" },
    );
  }

  const { boardId } = await params;

  if (!boardId || typeof boardId !== "string") {
    return respond(
      jsonError("invalid_board", "보드 정보를 확인해주세요.", 400, { hint: "invalid_board_id", requestId }),
      { code: "invalid_board", hint: "invalid_board_id" },
    );
  }

  let userId: string | null = null;

  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return respond(
      jsonError("unauthorized", "로그인이 필요합니다.", 401, {
        hint: "supabase_auth_failed",
        requestId,
      }),
      { code: "unauthorized", hint: "supabase_auth_failed" },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: unknown; description?: unknown }
    | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description =
    typeof body?.description === "string" && body.description.trim().length > 0
      ? body.description.trim()
      : null;

  if (!title) {
    return respond(
      jsonError("invalid_body", "제목을 입력해주세요.", 400, { hint: "invalid_title", requestId }),
      { code: "invalid_body", hint: "invalid_title" },
    );
  }

  try {
    await updateBoard({ boardId, ownerId: userId ?? "", title, description });
    return respond(jsonOk({ board: normalizeBoardSummary({ id: boardId, title, description }) }), {
      code: "board_updated",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드를 수정하지 못했습니다.";

    return respond(
      jsonError("board_update_failed", message, 500, { hint: "unexpected", requestId }),
      { code: "board_update_failed", hint: "unexpected" },
    );
  }
}
