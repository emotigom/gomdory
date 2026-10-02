import { NextRequest } from "next/server";

import { normalizeBoardRole, canEditBoard } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { generatePresentationCode } from "@/lib/edu/presentationLinks";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { EDU_COLUMNS, EDU_TABLES, EDU_RPC } from "@/lib/standards/eduDb";
import { jsonErrorWithRequestId, jsonOkWithRequestId, withNoStoreHeaders } from "@/lib/standards/apiServer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SHORT_PRESENTATION_ORIGIN = "https://www.gkrry.com";
const CODE_LENGTH = 8;
const MAX_CREATE_ATTEMPTS = 6;

type PresentationLinkPayload = {
  boardId?: string;
};

type PresentationLinkRow = {
  code: string;
  isActive: boolean;
  revokedAt: string | null;
};

type PresentationLinkResponse = {
  code: string;
  url: string;
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

async function enforceRateLimit(request: NextRequest, requestId: string, userId: string, key: string) {
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

function buildShortLink(code: string) {
  return `${SHORT_PRESENTATION_ORIGIN}/p/${code}`;
}

function isDuplicateCodeError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "23505" || Boolean(error.message?.includes("duplicate key"));
}

async function upsertPresentationCode(boardId: string) {
  const supabase = createSupabaseAdminClient();

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const code = generatePresentationCode(CODE_LENGTH);
    const { error } = await supabase.from(EDU_TABLES.presentationLinks).upsert(
      {
        [EDU_COLUMNS.boardId]: boardId,
        [EDU_COLUMNS.code]: code,
        [EDU_COLUMNS.isActive]: true,
        [EDU_COLUMNS.revokedAt]: null,
        [EDU_COLUMNS.updatedAt]: new Date().toISOString(),
      },
      { onConflict: EDU_COLUMNS.boardId },
    );

    if (!error) {
      return code;
    }

    if (isDuplicateCodeError(error)) {
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("presentation_link_generate_failed");
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const payload = (await request.json().catch(() => null)) as PresentationLinkPayload | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalidPayload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const boardId = payload.boardId?.trim() ?? "";
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

  const rateError = await enforceRateLimit(request, requestId, userId, `edu:presentation:link:ensure:${boardId}`);
  if (rateError) {
    return rateError;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = (await supabase
    .from(EDU_TABLES.presentationLinks)
    .select([EDU_COLUMNS.code, EDU_COLUMNS.isActive, EDU_COLUMNS.revokedAt].join(", "))
    .eq(EDU_COLUMNS.boardId, boardId)
    .maybeSingle()) as { data: PresentationLinkRow | null; error: { message: string } | null };

  if (error) {
    return jsonErrorWithRequestId("FETCH_FAILED", error.message, requestId, 500, undefined, withNoStoreHeaders());
  }

  const existing = data as unknown as Record<string, unknown> | null;
  const existingCode = existing ? String(existing[EDU_COLUMNS.code] ?? "") : "";
  const existingActive = existing ? Boolean(existing[EDU_COLUMNS.isActive]) : false;
  const existingRevokedAt = existing ? existing[EDU_COLUMNS.revokedAt] : null;

  if (existingCode && existingActive && !existingRevokedAt) {
    const response: PresentationLinkResponse = {
      code: existingCode,
      url: buildShortLink(existingCode),
    };
    return jsonOkWithRequestId(response, requestId, withNoStoreHeaders());
  }

  try {
    const code = await upsertPresentationCode(boardId);
    const response: PresentationLinkResponse = {
      code,
      url: buildShortLink(code),
    };
    return jsonOkWithRequestId(response, requestId, withNoStoreHeaders());
  } catch (createError) {
    const message = createError instanceof Error ? createError.message : "create_failed";
    return jsonErrorWithRequestId("CREATE_FAILED", message, requestId, 500, undefined, withNoStoreHeaders());
  }
}
