export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getWallV2Status, updateWallV2Enabled } from "@/lib/data/wallV2Migration.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

function respond(response: Response, requestId: string) {
  return withRequestId(response, requestId);
}

function isValidBoardId(boardId: string | undefined): boardId is string {
  return typeof boardId === "string" && boardId.trim().length > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const requestId = getOrCreateRequestId(request);

  if (!validateSupabaseEnv().ok) {
    return respond(
      jsonErrorWithRequestId(
        "supabaseEnvMissing",
        "환경 설정이 필요합니다. 잠시 후 다시 시도해 주세요.",
        requestId,
        500,
      ),
      requestId,
    );
  }

  const { boardId } = await params;
  if (!isValidBoardId(boardId)) {
    return respond(
      jsonErrorWithRequestId("invalidBoard", "보드 정보를 확인해주세요.", requestId, 400),
      requestId,
    );
  }

  try {
    await requireUserApi();
  } catch {
    return respond(
      jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401),
      requestId,
    );
  }

  try {
    const status = await getWallV2Status(boardId);
    if (!status) {
      return respond(
        jsonErrorWithRequestId("boardNotFound", "보드를 찾지 못했습니다.", requestId, 404),
        requestId,
      );
    }

    return respond(
      jsonOkWithRequestId(
        {
          status,
        },
        requestId,
      ),
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "상태를 불러오지 못했습니다.";
    return respond(
      jsonErrorWithRequestId("wallV2StatusFailed", message, requestId, 500),
      requestId,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const requestId = getOrCreateRequestId(request);

  if (!validateSupabaseEnv().ok) {
    return respond(
      jsonErrorWithRequestId(
        "supabaseEnvMissing",
        "환경 설정이 필요합니다. 잠시 후 다시 시도해 주세요.",
        requestId,
        500,
      ),
      requestId,
    );
  }

  const { boardId } = await params;
  if (!isValidBoardId(boardId)) {
    return respond(
      jsonErrorWithRequestId("invalidBoard", "보드 정보를 확인해주세요.", requestId, 400),
      requestId,
    );
  }

  try {
    await requireUserApi();
  } catch {
    return respond(
      jsonErrorWithRequestId("unauthorized", "로그인이 필요합니다.", requestId, 401),
      requestId,
    );
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;

  if (enabled === null) {
    return respond(
      jsonErrorWithRequestId("invalidBody", "토글 값을 확인해주세요.", requestId, 400),
      requestId,
    );
  }

  try {
    const updated = await updateWallV2Enabled(boardId, enabled);
    if (!updated) {
      return respond(
        jsonErrorWithRequestId("boardNotFound", "보드를 찾지 못했습니다.", requestId, 404),
        requestId,
      );
    }

    revalidatePath(`/dashboard/boards/${boardId}`);
    revalidatePath(`/dashboard/boards/${boardId}/grid`);

    return respond(
      jsonOkWithRequestId(
        {
          enabled: updated.enabled,
        },
        requestId,
      ),
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "변경하지 못했습니다.";
    return respond(
      jsonErrorWithRequestId("wallV2ToggleFailed", message, requestId, 500),
      requestId,
    );
  }
}
