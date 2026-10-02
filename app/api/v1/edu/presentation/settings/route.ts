import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { OPS_EVENT_FIELDS, OPS_EVENT_KIND, recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { EDU_COLUMNS, EDU_RPC, EDU_TABLES } from "@/lib/standards/eduDb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_INTERVALS = new Set([10, 20, 30, 60]);
const START_MODES = new Set(["auto", "selected"]);

type StartMode = "auto" | "selected";

type PresentationSettingsRow = {
  boardId: string;
  autoplayDefault: boolean;
  intervalSecDefault: number;
  startMode: StartMode;
  startSlug: string | null;
};

type PresentationSettingsResponse = {
  autoplayDefault: boolean;
  intervalSecDefault: number;
  startMode: StartMode;
  startSlug: string | null;
};

type PresentationSettingsPayload = {
  boardId?: string;
  autoplayDefault?: boolean;
  intervalSecDefault?: number;
  startMode?: StartMode;
  startSlug?: string | null;
};

async function requireTeacherAccess(boardId: string, requestId: string) {
  const supabaseServer = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabaseServer.rpc(EDU_RPC.boardRole, { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "보드를 확인하지 못했습니다.",
      requestId,
      404,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (!canEditBoard(boardRole)) {
    return jsonErrorWithRequestId(
      "FORBIDDEN",
      "이 보드에 접근할 수 없습니다.",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  return null;
}

async function enforceRateLimit(
  request: NextRequest,
  requestId: string,
  userId: string,
  key: string,
) {
  const subject = await getRateLimitSubject(request, userId);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;

  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `${key}:${subject}`,
        windowSeconds: 60,
        limit: 30,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rateLimited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const boardId = request.nextUrl.searchParams.get("boardId")?.trim() ?? "";

  if (!boardId) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId 값이 필요합니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const accessError = await requireTeacherAccess(boardId, requestId);
  if (accessError) {
    return accessError;
  }

  const rateError = await enforceRateLimit(request, requestId, userId, `edu:presentation:settings:get:${boardId}`);
  if (rateError) {
    return rateError;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.presentationSettings)
    .select(
      [
        EDU_COLUMNS.boardId,
        EDU_COLUMNS.autoplayDefault,
        EDU_COLUMNS.intervalSecDefault,
        EDU_COLUMNS.startMode,
        EDU_COLUMNS.startSlug,
      ].join(", "),
    )
    .eq(EDU_COLUMNS.boardId, boardId)
    .maybeSingle()) as { data: PresentationSettingsRow | null; error: { message: string } | null };

  if (error) {
    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  const mapped = mapSettingsRow(data);
  const response: PresentationSettingsResponse = {
    autoplayDefault: mapped?.autoplayDefault ?? false,
    intervalSecDefault: mapped?.intervalSecDefault ?? 20,
    startMode: mapped?.startMode ?? "auto",
    startSlug: mapped?.startSlug ?? null,
  };

  return jsonOkWithRequestId(response, requestId, withNoStoreHeaders());
}

const mapSettingsRow = (row: PresentationSettingsRow | null): PresentationSettingsRow | null => {
  if (!row) return null;
  const raw = row as unknown as Record<string, unknown>;
  const startModeValue = String(raw[EDU_COLUMNS.startMode] ?? "auto");
  const startMode = START_MODES.has(startModeValue) ? (startModeValue as StartMode) : "auto";
  return {
    boardId: String(raw[EDU_COLUMNS.boardId] ?? ""),
    autoplayDefault: Boolean(raw[EDU_COLUMNS.autoplayDefault]),
    intervalSecDefault: Number(raw[EDU_COLUMNS.intervalSecDefault] ?? 0),
    startMode,
    startSlug: raw[EDU_COLUMNS.startSlug] ? String(raw[EDU_COLUMNS.startSlug]) : null,
  };
};

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as PresentationSettingsPayload | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
  const autoplayDefault = typeof payload.autoplayDefault === "boolean" ? payload.autoplayDefault : null;
  const intervalSecDefault =
    typeof payload.intervalSecDefault === "number" ? payload.intervalSecDefault : null;
  const startMode = typeof payload.startMode === "string" ? payload.startMode.trim() : "";
  const startSlugRaw = typeof payload.startSlug === "string" ? payload.startSlug.trim() : "";

  if (!boardId) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "boardId 값이 필요합니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (
    autoplayDefault === null ||
    intervalSecDefault === null ||
    !ALLOWED_INTERVALS.has(intervalSecDefault) ||
    !START_MODES.has(startMode)
  ) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "autoplayDefault, intervalSecDefault, startMode 값이 올바르지 않습니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  if (startMode === "selected" && !startSlugRaw) {
    return jsonErrorWithRequestId(
      "INVALID_PARAMS",
      "startSlug 값이 필요합니다.",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const accessError = await requireTeacherAccess(boardId, requestId);
  if (accessError) {
    return accessError;
  }

  const rateError = await enforceRateLimit(request, requestId, userId, `edu:presentation:settings:post:${boardId}`);
  if (rateError) {
    return rateError;
  }

  const supabase = createSupabaseAdminClient();
  let startSlug: string | null = null;

  if (startMode === "selected" && startSlugRaw) {
    const { data: startProject, error: startProjectError } = await supabase
      .from(EDU_TABLES.projects)
      .select(EDU_COLUMNS.slug)
      .eq(EDU_COLUMNS.boardId, boardId)
      .eq(EDU_COLUMNS.slug, startSlugRaw)
      .maybeSingle();

    if (startProjectError || !startProject) {
      return jsonErrorWithRequestId(
        "INVALID_PARAMS",
        "startSlug 값이 올바르지 않습니다.",
        requestId,
        400,
        undefined,
        withNoStoreHeaders(),
      );
    }

    startSlug = startSlugRaw;
  }

  const { error } = await supabase
    .from(EDU_TABLES.presentationSettings)
    .upsert(
      {
        [EDU_COLUMNS.boardId]: boardId,
        [EDU_COLUMNS.autoplayDefault]: autoplayDefault,
        [EDU_COLUMNS.intervalSecDefault]: intervalSecDefault,
        [EDU_COLUMNS.startMode]: startMode,
        [EDU_COLUMNS.startSlug]: startSlug,
        [EDU_COLUMNS.updatedAt]: new Date().toISOString(),
        [EDU_COLUMNS.updatedBy]: userId,
      },
      { onConflict: EDU_COLUMNS.boardId },
    );

  if (error) {
    return jsonErrorWithRequestId("UPDATE_FAILED", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  void recordOpsEvent(
    {
      level: "info",
      kind: OPS_EVENT_KIND.apiAccess,
      [OPS_EVENT_FIELDS.requestId]: requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: {
        stage: "edu_presentation_settings_update",
        boardId,
        autoplayDefault,
        intervalSecDefault,
        startMode,
        startSlug,
        updatedBy: userId,
      },
    },
    { sampleRate: 1, hardLimitPerMinute: 60 },
  );

  return jsonOkWithRequestId(
    { autoplayDefault, intervalSecDefault, startMode, startSlug },
    requestId,
    withNoStoreHeaders(),
  );
}
