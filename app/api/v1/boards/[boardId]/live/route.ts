import { apiV1Path } from "@/lib/standards/pathTypes";

import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { buildShareUrl } from "@/lib/http/publicLinks";
import { getLiveSnapshotByBoard } from "@/lib/live/getLiveSnapshot";
import { failLive, okLive, type LiveWarning } from "@/lib/live/liveResponse";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 8000;
const ROUTE_PATH = apiV1Path("boards/[boardId]/live");

type LiveDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  getLiveSnapshotByBoardFn?: typeof getLiveSnapshotByBoard;
};

async function withTimeout<T>(
  operation: () => PromiseLike<T>,
  timeoutMs: number,
  timeoutLabel: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutLabel));
    }, timeoutMs);
  });

  const result = await Promise.race([operation(), timeoutPromise]);
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  return result as T;
}

function respond(
  payload: Record<string, unknown>,
  requestId: string,
  status = 200,
  context?: { startedAt: number },
) {
  const response = NextResponse.json(payload, { status });
  response.headers.set("cache-control", "no-store");
  if (context) {
    const durationMs = Date.now() - context.startedAt;
    if (durationMs > 1500) {
      void recordOpsEvent({
        level: "warn",
        kind: "api_slow",
        request_id: requestId,
        route: ROUTE_PATH,
        status,
        duration_ms: durationMs,
        meta: { durationMs, status },
      });
    }
  }
  return response;
}

function jsonError(
  code: string,
  message: string,
  requestId: string,
  status = 400,
  context?: { startedAt: number },
) {
  return respond(failLive({ requestId, code, message }), requestId, status, context);
}

async function logBoardLiveError(
  error: unknown,
  requestId: string,
  boardId: string,
  startedAt: number,
  errorName: string,
) {
  const message = error instanceof Error ? error.message : String(error);
  void recordOpsEvent({
    level: "error",
    kind: "api_error",
    request_id: requestId,
    route: ROUTE_PATH,
    status: 500,
    duration_ms: Date.now() - startedAt,
    meta: {
      boardId,
      durationMs: Date.now() - startedAt,
      errorName,
      message,
    },
  });
}

function sanitizePatch(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const patch = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (typeof patch.flowId === "string") result.flowId = patch.flowId;
  if (typeof patch.stepId === "string") result.stepId = patch.stepId;
  if (typeof patch.stepIndex === "number") result.stepIndex = patch.stepIndex;
  if (typeof patch.label === "string") result.label = patch.label;
  if (patch.target === "class" || patch.target === "share" || patch.target === "present") {
    result.target = patch.target;
  }
  if (typeof patch.safe === "boolean") result.safe = patch.safe;
  if (typeof patch.focus === "boolean") result.focus = patch.focus;
  if (typeof patch.pinnedQuestionId === "string" || patch.pinnedQuestionId === null) {
    result.pinnedQuestionId = patch.pinnedQuestionId;
  }
  if (typeof patch.pinnedQuestionUpdatedAt === "number" || patch.pinnedQuestionUpdatedAt === null) {
    result.pinnedQuestionUpdatedAt = patch.pinnedQuestionUpdatedAt;
  }
  if (typeof patch.qnaOpen === "boolean") result.qnaOpen = patch.qnaOpen;
  if (typeof patch.qnaEndsAt === "number" || patch.qnaEndsAt === null) {
    result.qnaEndsAt = patch.qnaEndsAt;
  }
  if (typeof patch.qnaPrompt === "string" || patch.qnaPrompt === null) {
    result.qnaPrompt = patch.qnaPrompt;
  }
  if (typeof patch.presenceNudgeAt === "number" || patch.presenceNudgeAt === null) {
    result.presenceNudgeAt = patch.presenceNudgeAt;
  }
  if (typeof patch.demoStepIndex === "number") {
    result.demoStepIndex = patch.demoStepIndex;
  }
  if (patch.currentStep && typeof patch.currentStep === "object") {
    const currentStep = patch.currentStep as Record<string, unknown>;
    if (
      typeof currentStep.flowId === "string" &&
      typeof currentStep.stepId === "string" &&
      typeof currentStep.stepIndex === "number" &&
      typeof currentStep.startedAt === "number"
    ) {
      const nextStep: Record<string, unknown> = {
        flowId: currentStep.flowId,
        stepId: currentStep.stepId,
        stepIndex: currentStep.stepIndex,
        startedAt: currentStep.startedAt,
      };
      if (typeof currentStep.title === "string") nextStep.title = currentStep.title;
      if (typeof currentStep.prompt === "string") nextStep.prompt = currentStep.prompt;
      if (typeof currentStep.seconds === "number") nextStep.seconds = currentStep.seconds;
      if (typeof currentStep.actionsApplied === "boolean") nextStep.actionsApplied = currentStep.actionsApplied;
      if (typeof currentStep.paused === "boolean") nextStep.paused = currentStep.paused;
      if (typeof currentStep.pausedAt === "number") nextStep.pausedAt = currentStep.pausedAt;
      if (currentStep.actions && typeof currentStep.actions === "object") {
        const actions = currentStep.actions as Record<string, unknown>;
        const normalizedActions: Record<string, unknown> = {};
        if (actions.qa === "open" || actions.qa === "close") {
          normalizedActions.qa = actions.qa;
        }
        if (actions.pulse === "reset") {
          normalizedActions.pulse = "reset";
        }
        if (actions.poll && typeof actions.poll === "object") {
          const poll = actions.poll as Record<string, unknown>;
          if (poll.mode === "open" || poll.mode === "close") {
            const pollEntry: Record<string, unknown> = { mode: poll.mode };
            if (typeof poll.pollId === "string") pollEntry.pollId = poll.pollId;
            normalizedActions.poll = pollEntry;
          }
        }
        if (Object.keys(normalizedActions).length > 0) {
          nextStep.actions = normalizedActions;
        }
      }
      result.currentStep = nextStep;
    }
  }
  if (typeof patch.ts === "number") result.ts = patch.ts;

  return result;
}

async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  ops: WithOpsContext,
  deps?: LiveDeps,
) {
  const { requestId, startedAt } = ops;
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.", requestId, 400, {
      startedAt,
    });
  }

  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;

  try {
    await ensureUser();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", requestId, 401, { startedAt });
  }

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await withTimeout(
    () => supabase.rpc("board_role", { bid: boardId }),
    REQUEST_TIMEOUT_MS,
    "board_role_timeout",
  );
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", requestId, 403, { startedAt });
  }

  try {
    const loadLiveSnapshot = deps?.getLiveSnapshotByBoardFn ?? getLiveSnapshotByBoard;
    const [liveSnapshot, board] = await Promise.all([
      loadLiveSnapshot(boardId),
      withTimeout(
        () =>
          supabase
            .from("boards")
            .select("active_session_id, share_code")
            .eq("id", boardId)
            .maybeSingle(),
        REQUEST_TIMEOUT_MS,
        "board_fetch_timeout",
      ),
    ]);

    if (board.error) {
      throw new Error(board.error.message);
    }

    const boardRow = board.data as { active_session_id?: string | null; share_code?: string | null } | null;
    const shareCode = boardRow?.share_code ?? null;
    const activeSessionId = boardRow?.active_session_id ?? null;
    const snapshot = liveSnapshot.snapshot ?? null;
    const data = liveSnapshot.session
      ? { ...liveSnapshot.session, activeSessionId }
      : { snapshot: null, version: null, activeSessionId };

    let warning: LiveWarning | undefined;
    let status = liveSnapshot.status;

    if (!shareCode) {
      status = "uninitialized";
      warning = { code: "missing_share_code", message: "공유 코드가 아직 없습니다." };
    } else if (liveSnapshot.warning) {
      warning = liveSnapshot.warning;
    }

    return respond(
      okLive({
        requestId,
        status,
        snapshot,
        share: {
          code: shareCode,
          url: shareCode ? buildShareUrl(shareCode) : null,
        },
        warning,
        extra: {
          boardId,
          data,
        },
      }),
      requestId,
      200,
      { startedAt },
    );
  } catch (error) {
    await logBoardLiveError(error, requestId, boardId, startedAt, "live_session_failed");
    return jsonError("live_session_failed", "라이브 세션을 불러오지 못했습니다.", requestId, 500, {
      startedAt,
    });
  }
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  ops: WithOpsContext,
) {
  const { requestId, startedAt } = ops;
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.", requestId, 400, {
      startedAt,
    });
  }

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", requestId, 401, { startedAt });
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await withTimeout(
    () => supabase.rpc("board_role", { bid: boardId }),
    REQUEST_TIMEOUT_MS,
    "board_role_timeout",
  );
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", requestId, 403, { startedAt });
  }

  const body = (await request.json().catch(() => null)) as { patch?: unknown } | null;
  const patch = sanitizePatch(body?.patch ?? null);

  if (!patch || Object.keys(patch).length === 0) {
    return jsonError("invalid_payload", "업데이트할 값이 없습니다.", requestId, 400, { startedAt });
  }

  try {
    const result = await withTimeout(
      () => upsertBoardLiveSession(boardId, patch),
      REQUEST_TIMEOUT_MS,
      "live_session_update_timeout",
    );
    return respond({ ok: true, data: result, requestId }, requestId, 200, { startedAt });
  } catch (error) {
    await logBoardLiveError(error, requestId, boardId, startedAt, "live_session_failed");
    return jsonError("live_session_failed", "라이브 세션을 업데이트하지 못했습니다.", requestId, 200, {
      startedAt,
    });
  }
}

export const GET = withOps(handleGet, { log: true });
export const POST = withOps(handlePost, { log: true });
