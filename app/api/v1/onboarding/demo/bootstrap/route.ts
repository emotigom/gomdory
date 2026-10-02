export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createBoard } from "@/lib/data/boards.server";
import { enableSharing } from "@/lib/data/share";
import { startSession } from "@/lib/data/sessionsReport";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateSupabaseEnv } from "@/lib/server/env";
import { DEMO_DEFAULT_ANNOUNCEMENT, DEMO_SCENARIO } from "@/lib/onboarding/demoScenario";

const DEMO_BOARD_TITLE = "첫 수업 데모 보드";
const DEMO_BOARD_DESCRIPTION = "3단계 데모 시나리오로 수업 흐름을 체감해보세요.";

function buildStudentUrl(code: string) {
  return `https://gkrry.com/s/${code}`;
}

function buildProjectorUrl(code: string) {
  return `https://gkrry.com/s/${code}/present?demo=1`;
}

function buildRemoteUrl(boardId: string, code: string) {
  return `https://www.gomdory.com/dashboard/boards/${boardId}/board?code=${code}&demo=1`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getOrCreateRequestId(request);
  const logRequest = (status: number, context?: Record<string, unknown>) => {
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

  const respond = (response: Response, context?: Record<string, unknown>) => {
    const withId = withRequestId(response, requestId);
    logRequest(withId.status, context);
    return withId;
  };

  const envValidation = validateSupabaseEnv();
  if (!envValidation.ok) {
    return respond(
      jsonError(
        "supabase_env_missing",
        "데모를 실행할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        500,
        { hint: "supabase_env_missing", requestId },
      ),
      { code: "supabase_env_missing", hint: "supabase_env_missing" },
    );
  }

  let userId: string;

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
    const board = await createBoard({
      title: DEMO_BOARD_TITLE,
      description: DEMO_BOARD_DESCRIPTION,
      boardViewType: "grid",
    });

    const shared = await enableSharing(board.id);
    const session = await startSession({ boardId: board.id, shareCode: shared.share_code ?? null, createdBy: userId });
    await upsertBoardLiveSession(board.id, {
      studentHudSettings: { announcement: DEMO_DEFAULT_ANNOUNCEMENT, updatedAt: Date.now() },
      demoStepIndex: 0,
      ts: Date.now(),
    });

    const code = shared.share_code ?? "";
    const studentUrl = buildStudentUrl(code);
    const projectorUrl = buildProjectorUrl(code);
    const remoteUrl = buildRemoteUrl(board.id, code);

    return respond(
      jsonOk({
        boardId: board.id,
        sessionId: session.id,
        code,
        studentUrl,
        projectorUrl,
        remoteUrl,
        demo: {
          scenarioId: DEMO_SCENARIO.scenarioId,
          steps: DEMO_SCENARIO.steps,
        },
      }),
      { code: "demo_bootstrap_ok", boardId: board.id, sessionId: session.id },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "데모 준비를 완료하지 못했습니다.";

    return respond(
      jsonError("demo_bootstrap_failed", message, 500, { hint: "unexpected", requestId }),
      { code: "demo_bootstrap_failed", hint: "unexpected" },
    );
  }
}
