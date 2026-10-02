export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { apiV1Path } from "@/lib/standards/pathTypes";
import type { User } from "@supabase/supabase-js";

import { logAudit } from "@/lib/data/audit";
import { normalizeBoardSummary } from "@/lib/data/boards";
import { listBoardsForUser } from "@/lib/data/boards.server";
import { withRequestContext, type RequestContext } from "@/lib/api/server/requestContext";
import { logWithContext } from "@/lib/ops/logWithContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dbCols } from "@/lib/standards/dbCols";
import { validateSupabaseEnv } from "@/lib/server/env";

type Dependencies = {
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  getUserFn?: (
    supabase: ReturnType<typeof createSupabaseServerClient>,
    bearerToken?: string | null,
  ) => Promise<{ user: User | null; error?: string }>;
  listBoardsFn?: typeof listBoardsForUser;
  validateSupabaseEnvFn?: typeof validateSupabaseEnv;
};

function pickSupabaseErrorMeta(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const err = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    status?: unknown;
  };

  return {
    code: typeof err.code === "string" ? err.code : null,
    message: typeof err.message === "string" ? err.message : null,
    details: typeof err.details === "string" ? err.details : null,
    hint: typeof err.hint === "string" ? err.hint : null,
    status: typeof err.status === "number" ? err.status : null,
  };
}

async function ensureUser(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  bearerToken?: string | null,
): Promise<{ user: User | null; error?: string }> {
  const { data, error } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, error: error?.message ?? "unauthorized" };
  }

  return { user: data.user, error: undefined };
}

function readBearerAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function handleGet(
  request: NextRequest,
  _context: unknown,
  requestContext: RequestContext,
  deps?: Dependencies,
) {
  const supabaseFactory = deps?.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const getUser = deps?.getUserFn ?? ensureUser;
  const fetchBoards = deps?.listBoardsFn ?? listBoardsForUser;
  const validateEnv = deps?.validateSupabaseEnvFn ?? validateSupabaseEnv;
  const noStore = withNoStoreHeaders();

  const logRequest = (status: number, context?: Record<string, unknown>) => {
    logWithContext({
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      stage: "dashboard_boards",
      requestId: requestContext.requestId,
      route: request.nextUrl.pathname,
      status,
      meta: context ?? null,
    });
  };

  const envValidation = validateEnv();

  if (!envValidation.ok) {
    logRequest(503, { code: "supabase_env_missing", hint: "supabase_env_missing" });
    return jsonErrorWithRequestId(
      "SERVICE_UNAVAILABLE",
      "보드 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      requestContext.requestId,
      503,
      { hint: "supabase_env_missing" },
      noStore,
    );
  }

  const bearerToken = readBearerAccessToken(request);
  const supabase = supabaseFactory(
    bearerToken ? { authorization: `Bearer ${bearerToken}` } : undefined,
  );

  let userId: string | null = null;
  const userResult = await getUser(supabase, bearerToken);
  if (!userResult.user) {
    logRequest(401, { code: "UNAUTHENTICATED", hint: "supabase_auth_failed" });
    return jsonErrorWithRequestId(
      "UNAUTHENTICATED",
      "로그인이 필요합니다.",
      requestContext.requestId,
      401,
      { hint: "supabase_auth_failed" },
      noStore,
    );
  }
  userId = userResult.user.id;

  try {
    const boards = await fetchBoards({ supabase, userId: userId ?? "" });
    const lite = request.nextUrl.searchParams.get("lite") === "1";
    if (lite) {
      const liteBoards = boards.map((board) => ({
        boardId: board.id,
        title: board.title,
        updatedAt: board.class_updated_at ?? board.created_at ?? null,
        shareCode: board.share_code ?? null,
      }));
      const data = { boards: liteBoards };
      const schemaVersion = SCHEMA_VERSIONS.dashboardBoards;
      const contractHash = computeContractHash(data);
      logRequest(200);
      return jsonOkWithRequestId(
        { schemaVersion, contractHash, ...data },
        requestContext.requestId,
        noStore,
      );
    }
    const normalizedBoards = boards
      .map((board) => normalizeBoardSummary({ ...board, boardId: board.id }))
      .filter((board): board is NonNullable<typeof board> => Boolean(board));

    const data = { boards: normalizedBoards };
    const schemaVersion = SCHEMA_VERSIONS.dashboardBoards;
    const contractHash = computeContractHash(data);
    logRequest(200);
    return jsonOkWithRequestId(
      { schemaVersion, contractHash, ...data },
      requestContext.requestId,
      noStore,
    );
  } catch (error) {
    const supabaseMeta = pickSupabaseErrorMeta(error);
    const supabaseErrorCode =
      typeof error === "object" && error && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
    console.error(
      JSON.stringify({
        level: "error",
        stage: "dashboard_boards_query_failed",
        requestId: requestContext.requestId,
        supabaseErrorCode: supabaseErrorCode ?? null,
        supabase: supabaseMeta,
      }),
    );

    logRequest(500, {
      code: "INTERNAL_ERROR",
      hint: "unexpected",
      supabaseErrorCode,
      supabase: supabaseMeta,
    });
    return jsonErrorWithRequestId(
      "INTERNAL_ERROR",
      "보드 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      requestContext.requestId,
      500,
      { hint: "unexpected", supabaseErrorCode },
      noStore,
    );
  }
}

async function handlePost(
  request: NextRequest,
  _context: unknown,
  requestContext: RequestContext,
  deps?: Dependencies,
) {
  const requestId = requestContext.requestId;
  const supabaseFactory = deps?.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const getUser = deps?.getUserFn ?? ensureUser;
  const validateEnv = deps?.validateSupabaseEnvFn ?? validateSupabaseEnv;

  const routeLabel = `POST ${apiV1Path("dashboard/boards")}`;
  const startedAt = requestContext.startedAt;

  console.info(
    JSON.stringify({
      level: "info",
      requestId,
      route: routeLabel,
      msg: "start",
    }),
  );

  try {
    let rawText = "";
    try {
      rawText = await request.text();
    } catch {
      rawText = "";
    }

    const trimmed = typeof rawText === "string" ? rawText.trim() : "";
    let payload: Record<string, unknown> = {};
    if (trimmed) {
      try {
        const normalized = trimmed.replace(/^\uFEFF/, "");
        const parsed = JSON.parse(normalized);
        payload = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      } catch {
        console.warn(
          JSON.stringify({
            level: "warn",
            requestId,
            route: routeLabel,
            msg: "bad_json",
            sample: trimmed.slice(0, 120),
          }),
        );
        return jsonErrorWithRequestId(
          "BAD_JSON",
          "요청 본문(JSON)을 해석할 수 없습니다.",
          requestId,
          400,
        );
      }
    }

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!title) {
      console.warn(
        JSON.stringify({
          level: "warn",
          requestId,
          route: routeLabel,
          msg: "validation_error",
        }),
      );
      return jsonErrorWithRequestId("VALIDATION_ERROR", "보드 제목을 입력해 주세요.", requestId, 400);
    }

    if (title.length > 80) {
      console.warn(
        JSON.stringify({
          level: "warn",
          requestId,
          route: routeLabel,
          msg: "validation_error",
        }),
      );
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "보드 제목은 1~80자 이내로 입력해주세요.",
        requestId,
        400,
      );
    }

    const description =
      typeof payload.description === "string" ? payload.description.trim() : "";
    if (description.length > 280) {
      console.warn(
        JSON.stringify({
          level: "warn",
          requestId,
          route: routeLabel,
          msg: "validation_error",
        }),
      );
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "설명은 280자 이내로 입력해주세요.",
        requestId,
        400,
      );
    }

    const envValidation = validateEnv();

    if (!envValidation.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          route: routeLabel,
          msg: "supabase_env_missing",
        }),
      );
      return jsonErrorWithRequestId(
        "SERVICE_UNAVAILABLE",
        "보드를 만들 수 없습니다. 잠시 후 다시 시도해 주세요.",
        requestId,
        503,
      );
    }

    const boardViewType =
      payload.boardViewType === "wall" || payload.boardViewType === "grid"
        ? payload.boardViewType
        : "grid";
    const classId =
      typeof payload.classId === "string" && payload.classId.trim() ? payload.classId.trim() : null;

    const supabase = supabaseFactory();
    const userResult = await getUser(supabase);

    if (!userResult.user) {
      console.warn(
        JSON.stringify({
          level: "warn",
          requestId,
          route: routeLabel,
          msg: "unauthenticated",
        }),
      );
      return jsonErrorWithRequestId("UNAUTHENTICATED", "로그인이 필요합니다.", requestId, 401);
    }

    const userId = userResult.user.id;
    const { data, error } = await supabase
      .from("boards")
      .insert({
        owner_id: userId,
        title,
        description: description.length ? description : null,
        board_view_type: boardViewType,
        class_id: classId,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          route: routeLabel,
          msg: "db_insert_failed",
          sbCode: error?.code ?? null,
          message: error?.message ?? null,
        }),
      );
      return jsonErrorWithRequestId("DB_INSERT_FAILED", "보드를 생성하지 못했습니다.", requestId, 500);
    }

    const { data: wallData, error: wallError } = await supabase
      .from("walls")
      .insert({
        [dbCols.walls.boardId]: data.id,
        title: "담벼락 1",
        description: null,
        position: 1,
      })
      .select("id")
      .single();

    if (wallError || !wallData) {
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          route: routeLabel,
          msg: "wall_insert_failed",
          sbCode: wallError?.code ?? null,
          message: wallError?.message ?? null,
          boardId: data.id,
        }),
      );

      const { error: rollbackError } = await supabase.from("boards").delete().eq("id", data.id);
      if (rollbackError) {
        console.error(
          JSON.stringify({
            level: "error",
            requestId,
            route: routeLabel,
            msg: "board_rollback_failed",
            sbCode: rollbackError?.code ?? null,
            message: rollbackError?.message ?? null,
            boardId: data.id,
          }),
        );
      }

      return jsonErrorWithRequestId(
        "INTERNAL_ERROR",
        "보드를 생성하지 못했습니다.",
        requestId,
        500,
      );
    }

    void logAudit({
      boardId: data.id,
      action: "board.created",
      targetType: "board",
      targetId: data.id,
      meta: { title, boardViewType },
    }).catch((auditError) => {
      console.error(
        JSON.stringify({
          level: "error",
          requestId,
          route: routeLabel,
          msg: "audit_failed",
          message: auditError instanceof Error ? auditError.message : "unknown",
        }),
      );
    });

    const tookMs = Math.max(0, Date.now() - startedAt);
    console.info(
      JSON.stringify({
        level: "info",
        requestId,
        route: routeLabel,
        msg: "success",
        boardId: data.id,
        tookMs,
      }),
    );

    const responseData = { board: { boardId: data.id, initialWallId: wallData.id } };
    const schemaVersion = SCHEMA_VERSIONS.dashboardBoards;
    const contractHash = computeContractHash(responseData);

    return jsonOkWithRequestId(
      { schemaVersion, contractHash, ...responseData },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        route: routeLabel,
        msg: "internal_error",
        message,
      }),
    );

    return jsonErrorWithRequestId("INTERNAL_ERROR", "알 수 없는 오류가 발생했습니다.", requestId, 500);
  }
}

export const GET = withRequestContext(handleGet);
export const POST = withRequestContext(handlePost);
