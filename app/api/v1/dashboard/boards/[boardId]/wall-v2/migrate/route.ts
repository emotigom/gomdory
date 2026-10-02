export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import {
  getWallV2MigrationPreview,
  getWallV2Status,
  migrateWallsToV2,
} from "@/lib/data/wallV2Migration.server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";

type MigrationMode = "dry-run" | "apply";

function respond(response: Response, requestId: string) {
  return withRequestId(response, requestId);
}

function isValidBoardId(boardId: string | undefined): boardId is string {
  return typeof boardId === "string" && boardId.trim().length > 0;
}

function parseMode(value: unknown): MigrationMode | null {
  return value === "dry-run" || value === "apply" ? value : null;
}

export async function POST(
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

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode = parseMode(body?.mode);

  if (!mode) {
    return respond(
      jsonErrorWithRequestId("invalidBody", "요청 형식을 확인해주세요.", requestId, 400),
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

    if (mode === "apply" && status.classState === "ended") {
      return respond(
        jsonErrorWithRequestId(
          "classEnded",
          "종료된 수업에서는 마이그레이션을 실행할 수 없습니다.",
          requestId,
          400,
        ),
        requestId,
      );
    }

    if (mode === "dry-run") {
      const preview = await getWallV2MigrationPreview(boardId);
      return respond(
        jsonOkWithRequestId(
          {
            preview,
          },
          requestId,
        ),
        requestId,
      );
    }

    const result = await migrateWallsToV2(boardId);
    revalidatePath(`/dashboard/boards/${boardId}`);
    revalidatePath(`/dashboard/boards/${boardId}/grid`);

    return respond(
      jsonOkWithRequestId(
        {
          result,
        },
        requestId,
      ),
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "마이그레이션에 실패했습니다.";
    return respond(
      jsonErrorWithRequestId("wallV2MigrationFailed", message, requestId, 500),
      requestId,
    );
  }
}
