export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { setActiveClassBoard } from "@/lib/data/classes.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  setActiveClassBoardFn?: typeof setActiveClassBoard;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const setActiveFn = deps?.setActiveClassBoardFn ?? setActiveClassBoard;
  const validateEnv = deps?.validateSupabaseEnvFn ?? validateSupabaseEnv;

  const requestId = getOrCreateRequestId(request);
  const envValidation = validateEnv();

  if (!envValidation.ok) {
    return jsonErrorWithRequestId(
      "supabase_env_missing",
      "활성 보드를 변경할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      requestId,
      500,
    );
  }

  try {
    await ensureUser();
  } catch {
    return jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401);
  }

  const { classId } = await params;
  if (!classId) {
    return jsonErrorWithRequestId("invalid_class", "클래스를 확인하지 못했습니다.", requestId, 400);
  }

  const body = (await request.json().catch(() => null)) as { activeBoardId?: unknown } | null;
  const activeBoardId =
    typeof body?.activeBoardId === "string" && body.activeBoardId.trim().length > 0
      ? body.activeBoardId.trim()
      : null;

  try {
    const updated = await setActiveFn({ classId, activeBoardId });
    return jsonOkWithRequestId({ class: updated }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "활성 보드를 변경하지 못했습니다.";
    return jsonErrorWithRequestId("active_board_update_failed", message, requestId, 500);
  }
}
