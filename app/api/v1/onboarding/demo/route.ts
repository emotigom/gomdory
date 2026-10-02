export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { withRequestId } from "@/lib/api/server/requestId";
import { jsonError, jsonOk } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createBoard } from "@/lib/data/boards.server";
import { createCard } from "@/lib/data/cards";
import { enableSharing } from "@/lib/data/share";
import { createWall } from "@/lib/data/walls";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { startSession } from "@/lib/data/sessionsReport";
import { validateSupabaseEnv } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProjectorUrl, getStudentUrl } from "@/lib/share/shareUrls";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import { getOrCreateRequestId } from "@/lib/http/requestId";

const DEMO_BOARD_TITLE = "데모 수업 보드";
const DEMO_BOARD_DESCRIPTION = "60초 안에 학생 화면, 프로젝터, 리모컨까지 시연해보세요.";
const DEMO_WALL_TITLE = "데모 클래스";
const DEMO_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type DemoDeps = {
  validateEnvFn?: typeof validateSupabaseEnv;
  requireUserApiFn?: typeof requireUserApi;
  createBoardFn?: typeof createBoard;
  createWallFn?: typeof createWall;
  createCardFn?: typeof createCard;
  enableSharingFn?: typeof enableSharing;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  startSessionFn?: typeof startSession;
  upsertBoardLiveSessionFn?: typeof upsertBoardLiveSession;
  now?: () => Date;
};

type DemoBoard = {
  id: string;
  shareCode: string;
};

async function findRecentDemoBoard(
  ownerId: string,
  lookbackMs: number,
  deps: Required<Pick<DemoDeps, "createSupabaseServerClientFn" | "now">>,
): Promise<DemoBoard | null> {
  const supabase = deps.createSupabaseServerClientFn();
  const since = new Date(deps.now().getTime() - lookbackMs).toISOString();
  const { data, error } = await supabase
    .from("boards")
    .select("id, share_code")
    .eq("owner_id", ownerId)
    .eq("title", DEMO_BOARD_TITLE)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  if (!data) return null;

  return { id: data.id, shareCode: data.share_code ?? "" };
}

async function seedDemoBoard(
  ownerId: string,
  deps: Required<
    Pick<
      DemoDeps,
      "createBoardFn" | "createWallFn" | "createCardFn" | "enableSharingFn" | "startSessionFn" | "upsertBoardLiveSessionFn"
    >
  >,
): Promise<{ boardId: string; shareCode: string }> {
  const board = await deps.createBoardFn({
    title: DEMO_BOARD_TITLE,
    description: DEMO_BOARD_DESCRIPTION,
    boardViewType: "grid",
  });

  const wall = await deps.createWallFn({ boardId: board.id, title: DEMO_WALL_TITLE });

  const demoCards = [
    "👋 환영합니다! 60초 안에 학생 화면 + 프로젝터 화면을 모두 확인해보세요.",
    "오늘의 목표\n- 학생 화면을 열고 액션바 버튼(질문/도움/펄스)을 눌러봅니다.\n- 프로젝터/HUD 화면을 띄워 현장 시연을 준비합니다.",
    "활동 순서 (3단계)\n1) 접속: QR 또는 코드로 참여\n2) 질문/도움: 학생이 버튼을 눌러보기\n3) 정리: 펄스 테스트로 마무리",
    "학생 액션바 안내\n아래 버튼이 실제로 동작합니다.\n- 질문 남기기\n- 도움 요청\n- 펄스 테스트 참여",
    "펄스 테스트 안내\n지금 바로 한 번 눌러보세요. HUD에서 응답이 집계됩니다.",
    "질문 예시 1\n오늘 수업에서 가장 기대되는 부분은?",
    "질문 예시 2\n도움이 필요한 학생을 어떻게 빠르게 파악할까요?",
    "리모컨 팁\n휴대폰에서 리모컨을 열어 바로 발표/HUD를 제어할 수 있습니다.",
    "클린/포커스/매니지 모드 안내\n- Clean: 수업 시작 런처\n- Focus: 질문/도움 관제\n- Manage: 정리/템플릿/파일",
    "프로젝트/학급 공유용 데모 보드입니다. 필요에 따라 자유롭게 수정하세요.",
  ];

  for (const text of demoCards) {
    await deps.createCardFn({ wallId: wall.id, text, boardId: board.id });
  }

  const share = await deps.enableSharingFn(board.id);

  const session = await deps.startSessionFn({
    boardId: board.id,
    shareCode: share.share_code ?? null,
    createdBy: ownerId,
  });
  await deps.upsertBoardLiveSessionFn(board.id, {
    studentHudSettings: {
      announcement: "데모 수업입니다. 액션바 버튼을 눌러 학생 화면을 확인해보세요.",
      updatedAt: Date.now(),
    },
    demoStepIndex: 0,
    activeSessionId: session.id,
    activeSessionStartedAt: session.started_at,
    ts: Date.now(),
  });

  return { boardId: board.id, shareCode: share.share_code ?? "" };
}

function buildRemoteUrl(boardId: string, shareCode: string) {
  const base = CANONICAL_BASE_URL.endsWith("/")
    ? CANONICAL_BASE_URL.slice(0, -1)
    : CANONICAL_BASE_URL;
  const query = shareCode ? `?code=${encodeURIComponent(shareCode)}&demo=1` : "?demo=1";
  return `${base}/dashboard/boards/${boardId}/board${query}`;
}

async function prepareDemoBoard(ownerId: string, deps: DemoDeps) {
  const now = deps.now ?? (() => new Date());
  const createSupabaseServerClientFn = deps.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const startSessionFn = deps.startSessionFn ?? startSession;
  const upsertBoardLiveSessionFn = deps.upsertBoardLiveSessionFn ?? upsertBoardLiveSession;
  const enableSharingFn = deps.enableSharingFn ?? enableSharing;
  const recent = await findRecentDemoBoard(ownerId, DEMO_LOOKBACK_MS, {
    createSupabaseServerClientFn,
    now,
  });

  if (recent) {
    const share = await enableSharingFn(recent.id);
    const shareCode = share.share_code ?? recent.shareCode ?? "";
    const session = await startSessionFn({ boardId: recent.id, shareCode, createdBy: ownerId });
    await upsertBoardLiveSessionFn(recent.id, {
      studentHudSettings: {
        announcement: "데모 수업입니다. 액션바 버튼을 눌러 학생 화면을 확인해보세요.",
        updatedAt: Date.now(),
      },
      demoStepIndex: 0,
      activeSessionId: session.id,
      activeSessionStartedAt: session.started_at,
      ts: Date.now(),
    });
    return { boardId: recent.id, shareCode };
  }

  return seedDemoBoard(ownerId, {
    createBoardFn: deps.createBoardFn ?? createBoard,
    createWallFn: deps.createWallFn ?? createWall,
    createCardFn: deps.createCardFn ?? createCard,
    enableSharingFn,
    startSessionFn,
    upsertBoardLiveSessionFn,
  });
}

export async function POST(request: NextRequest, _context?: unknown, deps?: DemoDeps): Promise<Response> {
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

  const envValidation = (deps?.validateEnvFn ?? validateSupabaseEnv)();
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
    const { user } = await (deps?.requireUserApiFn ?? requireUserApi)();
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
    const { boardId, shareCode } = await prepareDemoBoard(userId, deps ?? {});
    const studentUrl = getStudentUrl(shareCode);
    const projectorUrl = `${getProjectorUrl(shareCode)}?demo=1`;
    const remoteUrl = buildRemoteUrl(boardId, shareCode);

    return respond(
      jsonOk({ ok: true, boardId, shareCode, studentUrl, projectorUrl, remoteUrl }),
      { code: "demo_ready", boardId },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "데모를 준비하지 못했습니다.";

    return respond(
      jsonError("demo_failed", message, 500, { hint: "unexpected", requestId }),
      { code: "demo_failed", hint: "unexpected" },
    );
  }
}
