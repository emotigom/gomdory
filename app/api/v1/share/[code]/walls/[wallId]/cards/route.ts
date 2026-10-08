import { apiV1Path } from "@/lib/standards/pathTypes";
import { api } from "@/lib/standards/routes";
import { cookies } from "next/headers";

import { createStudentCard, listWallCardsPaginatedForShare } from "@/lib/data/share";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { fingerprintFromRequest } from "@/lib/http/fingerprint";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { broadcastRealtimeEvent } from "@/lib/realtime/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, SupabaseRateLimitStore } from "@/lib/security/rateLimit";
import { verifyBypassCookie } from "@/lib/auth/turnstileBypass";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";
import { listReadyFilesForCards } from "@/lib/data/files";
import { normalizeStudentName } from "@/lib/student/studentName";
import { normalizeExternalAttachments } from "@/lib/types/attachments";
import { bumpBoardAndWallActivityByWallId, shouldBumpActivity } from "@/lib/db/activityBump";
import {
  getPublicShareWriteGuard,
  getPublicWallWriteGuard,
  resolvePublicShareWall,
} from "@/lib/share/public/access";
import { createQ2B5StudentFixtureCard, isQ2B5StudentCardFixtureEnabled, isQ2B5StudentCardFixtureTarget, isQ2B9DTurnstileFixtureEnabled, isQ2B9DTurnstileFixtureTarget, createQ2B10Card, isQ2B10FixtureEnabled, isQ2B10FixtureTarget, q2B10WriteGuard } from "@/lib/q2/browser/studentEntryFixture";
import { Q2_B9_D_EXPECTED_ACTION, Q2_B9_D_EXPECTED_CDATA, recordQ2B9DBusinessMutation, verifyQ2B9DTurnstileToken } from "@/lib/q2/browser/turnstileIntegrationFixture";

type StudentCardRequestBody = {
  text?: unknown;
  message?: unknown;
  content?: unknown;
  title?: unknown;
  body?: unknown;
  authorName?: unknown;
  viewerName?: unknown;
  turnstileToken?: unknown;
  clientId?: unknown;
  externalAttachments?: unknown;
};

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeTextCandidate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(CONTROL_CHARS, "").trim();
}

function extractContentText(content: unknown): string {
  if (content && typeof content === "object" && "text" in content) {
    return normalizeTextCandidate((content as { text?: unknown }).text);
  }

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as { text?: unknown };
        return normalizeTextCandidate(parsed?.text);
      } catch {
        return normalizeTextCandidate(content);
      }
    }
    return normalizeTextCandidate(content);
  }

  return "";
}

function normalizeStudentCardText(payload: StudentCardRequestBody): string {
  const candidates = [
    normalizeTextCandidate(payload.text),
    normalizeTextCandidate(payload.message),
    extractContentText(payload.content),
    normalizeTextCandidate(payload.body),
    normalizeTextCandidate(payload.title),
  ];
  return candidates.find((value) => value.length > 0) ?? "";
}

async function parseStudentCardBody(request: Request): Promise<StudentCardRequestBody | null> {
  const rawBody = await request.text().catch(() => "");
  if (!rawBody) {
    return null;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const looksJson = contentType.includes("application/json") || rawBody.trim().startsWith("{");
  if (looksJson) {
    try {
      return JSON.parse(rawBody) as StudentCardRequestBody;
    } catch {
      // fall through to urlencoded parsing
    }
  }

  const params = new URLSearchParams(rawBody);
  if (params.size === 0) {
    return null;
  }

  const payload: StudentCardRequestBody = {};
  for (const [key, value] of params.entries()) {
    (payload as Record<string, unknown>)[key] = value;
  }
  return payload;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; wallId: string }> },
) {
  const { code, wallId } = await params;
  const requestId = getOrCreateRequestId(request);

  const body = await parseStudentCardBody(request);
  if (!body) {
    return jsonErrorWithRequestId(
      "INVALID_BODY",
      "요청 본문을 확인해주세요.",
      requestId,
      400,
      {
        missingFields: ["text"],
        example: { text: "안녕하세요!" },
      },
    );
  }

  const normalizedText = normalizeStudentCardText(body);
  const textLength = normalizedText.length;
  const externalAttachments = normalizeExternalAttachments(body.externalAttachments);
  const missingFields: string[] = [];
  if (!normalizedText && externalAttachments.length === 0) {
    missingFields.push("text");
  }

  const rawClientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const clientId = rawClientId || `req-${requestId}`;
  if (missingFields.length > 0) {
    return jsonErrorWithRequestId(
      "INVALID_BODY",
      "요청 본문을 확인해주세요.",
      requestId,
      400,
      {
        missingFields,
        example: { text: "안녕하세요!" },
      },
    );
  }

  if (textLength > 1000) {
    return jsonErrorWithRequestId(
      "INVALID_BODY",
      "요청 본문을 확인해주세요.",
      requestId,
      400,
      {
        fieldErrors: { text: "카드 내용은 1000자 이내로 입력해주세요." },
        example: { text: "안녕하세요!" },
      },
    );
  }

  // Q2-B9-D keeps this actual card-create endpoint and replaces only the
  // external verifier for non-production loopback fixture traffic.
  if (isQ2B9DTurnstileFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
    if (!isQ2B9DTurnstileFixtureTarget(code, wallId)) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }
    const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
    const origin = request.headers.get("origin");
    const hostname = origin ? new URL(origin).host : "";
    const verification = verifyQ2B9DTurnstileToken(token, { hostname, action: Q2_B9_D_EXPECTED_ACTION, cdata: Q2_B9_D_EXPECTED_CDATA });
    if (!verification.ok) return jsonErrorWithRequestId("TURNSTILE_FAILED", "보안 확인을 다시 진행해 주세요.", requestId, 400);
    return jsonOkWithRequestId({ cardId: recordQ2B9DBusinessMutation() }, requestId);
  }

  if (isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
    if (!isQ2B5StudentCardFixtureTarget(code, wallId)) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }
    const card = createQ2B5StudentFixtureCard({ text: normalizedText, authorClientId: typeof body.clientId === "string" ? body.clientId : "q2-b5-guest" });
    if (!card) return jsonErrorWithRequestId("INVALID_BODY", "요청 본문을 확인해주세요.", requestId, 400);
    return jsonOkWithRequestId({ cardId: card.id }, requestId);
  }
  if (isQ2B10FixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
    if (!isQ2B10FixtureTarget(code, wallId)) return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    const writeGuard = q2B10WriteGuard();
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }
    const card = createQ2B10Card({ text: normalizedText, authorClientId: typeof body.clientId === "string" ? body.clientId : "q2-b10-guest" });
    return card ? jsonOkWithRequestId({ cardId: card.id }, requestId) : jsonErrorWithRequestId("INVALID_BODY", "요청 본문을 확인해주세요.", requestId, 400);
  }

  const { normalizedCode, board, wall } = await resolvePublicShareWall({ code, wallId });

  if (!board) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "공유 보드를 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  if (!wall) {
    return jsonErrorWithRequestId(
      "WALL_NOT_FOUND",
      "담벼락을 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  const writeGuard = getPublicShareWriteGuard(board);
  if (!writeGuard.ok) {
    return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
  }

  const wallWriteGuard = getPublicWallWriteGuard(wall);
  if (!wallWriteGuard.ok) {
    return jsonErrorWithRequestId(
      wallWriteGuard.code,
      wallWriteGuard.message,
      requestId,
      wallWriteGuard.status,
    );
  }

  const rawAuthorName =
    typeof body.authorName === "string"
      ? body.authorName
      : typeof body.viewerName === "string"
        ? body.viewerName
        : "";
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  const fingerprint = await fingerprintFromRequest(request);
  const store = new SupabaseRateLimitStore(createSupabaseAdminClient());
  const limitResult = await enforceRateLimit({
    key: `s:${normalizedCode}:${fingerprint}:card`,
    windowMs: 10_000,
    max: 1,
    store,
  });

  if (!limitResult.allowed) {
    const retryAfter = limitResult.retryAfterSec ?? 10;
    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "too_fast",
      requestId,
      429,
      undefined,
      { headers: { "Retry-After": `${retryAfter}` } },
    );
  }

  const cookieStore = await cookies();
  const cookieAuthorName = normalizeStudentName(cookieStore.get("gomdori_student_name")?.value ?? "");
  const authorName =
    normalizeStudentName(rawAuthorName) ||
    normalizeStudentName(request.headers.get("x-student-name") ?? "") ||
    cookieAuthorName ||
    "익명";
  const bypass = await verifyBypassCookie(cookieStore);
  if (!bypass) {
    const ip = request.headers.get("cf-connecting-ip") ?? undefined;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const userAgent = request.headers.get("user-agent");
    const cfRay = request.headers.get("cf-ray");
    const verification = await verifyTurnstileTokenWithTelemetry(turnstileToken, {
      requestId,
      route: api.share.wallCards(":code", ":wallId"),
      action: "share_card_create",
      expectedHostname: origin ?? referer,
      expectedAction: "share_card_create",
      expectedCdata: "share-card-create",
      originHost: origin,
      refererHost: referer,
      ip,
      userAgent,
      shareCode: normalizedCode,
      cfRay,
      cookiePresent: Boolean(request.headers.get("cookie")),
    });

    if (!verification.ok) {
      const headers = new Headers();
      headers.set("x-request-id", requestId);
      headers.set("x-gom-request-id", requestId);
      return Response.json(
        {
          ok: false,
          code: "TURNSTILE_FAILED",
          message: verification.userMessage,
          requestId: verification.requestId,
          retryable: verification.retryable,
          hint: verification.hint,
          error: verification.userMessage,
        },
        { status: 400, headers },
      );
    }
  }

  try {
    const card = await createStudentCard({
      wallId: wall.id,
      text: normalizedText,
      authorName,
      clientId,
      externalAttachments,
    });
    if (shouldBumpActivity("cardCreate")) {
      try {
        await bumpBoardAndWallActivityByWallId({ wallId: wall.id });
      } catch (bumpError) {
        console.debug("activity_bump_failed", bumpError);
      }
    }

    broadcastRealtimeEvent({
      boardId: board.id,
      shareCode: normalizedCode,
      event: {
        type: "card:created",
        payload: {
          wallId: wall.id,
          card: {
            id: card.id,
            wallId: wall.id,
            text: card.text,
            authorName: card.author_name,
            createdAt: card.created_at,
            isHidden: false,
            isPinned: card.is_pinned,
            isFeatured: card.is_featured,
            cardColorToken: card.card_color_token,
            hasAttachments: (card.external_attachments?.length ?? 0) > 0,
          },
          attachments:
            card.external_attachments?.length
              ? { fileCount: 0, externalCount: card.external_attachments.length }
              : undefined,
        },
      },
    }).catch((error) => console.warn("realtime broadcast failed", error));
    return jsonOkWithRequestId({ cardId: card.id }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드 작성 실패";

    return jsonErrorWithRequestId("CREATE_FAILED", message, requestId, 400);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; wallId: string }> },
) {
  const { code, wallId } = await params;
  const requestId = getOrCreateRequestId(request);
  if (isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
    if (!isQ2B5StudentCardFixtureTarget(code, wallId)) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }
    const { getQ2B5StudentCardFixture } = await import("@/lib/q2/browser/studentEntryFixture");
    const fixture = getQ2B5StudentCardFixture(code, true);
    const items = fixture?.viewModel.columns[0]?.cards ?? [];
    return jsonOkWithRequestId({ items, nextCursor: null }, requestId);
  }
  const { normalizedCode, board, wall } = await resolvePublicShareWall({ code, wallId });

  if (!board) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "공유 보드를 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  if (!wall) {
    return jsonErrorWithRequestId(
      "WALL_NOT_FOUND",
      "담벼락을 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const cursor = searchParams.get("cursor");
  const limit = Number.isFinite(Number(limitParam))
    ? Math.min(Math.max(Number(limitParam), 1), 200)
    : 40;

  try {
    const result = await listWallCardsPaginatedForShare({
      wallId: wall.id,
      cursor,
      limit,
    });

    const files = await listReadyFilesForCards(result.items.map((card) => card.id));
    const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
      acc[file.cardId] = acc[file.cardId] ?? [];
      acc[file.cardId]?.push(file);
      return acc;
    }, {});

    return jsonOkWithRequestId(
      {
        items: result.items.map((card) => ({
          id: card.id,
          wallId: card.wall_id,
          position: card.position ?? null,
          text: card.text,
          authorName: card.author_name,
          authorType: card.author_type ?? "teacher",
          createdAt: card.created_at,
          isPinned: card.is_pinned,
          isFeatured: card.is_featured,
          cardColorToken: card.card_color_token,
          hasAttachments:
            (filesByCardId[card.id]?.length ?? 0) > 0 ||
            (card.external_attachments?.length ?? 0) > 0,
          files: (filesByCardId[card.id] ?? []).map((file) => ({
            id: file.fileId,
            filename: file.filename,
            contentType: file.contentType,
            sizeBytes: file.byteSize,
            downloadUrl: apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`),
          })),
          externalAttachments: card.external_attachments,
        })),
        nextCursor: result.nextCursor,
      },
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("FETCH_FAILED", message, requestId, 400);
  }
}
