import { cookies } from "next/headers";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { normalizeShareCode } from "@/lib/data/share";
import {
  createStudentCardV2,
  listSectionCardsV2ForShare,
  listSectionsV2ForShareCode,
  type WallV2CardContent,
} from "@/lib/data/shareWallV2";
import { verifyBypassCookie } from "@/lib/auth/turnstileBypass";
import { fingerprintFromRequest } from "@/lib/http/fingerprint";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { enforceRateLimit, SupabaseRateLimitStore } from "@/lib/security/rateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstileTokenWithTelemetry } from "@/lib/turnstile";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; sectionId: string }> },
) {
  const { code, sectionId } = await params;
  const requestId = getOrCreateRequestId(request);
  const normalizedCode = normalizeShareCode(code);

  const shareData = await listSectionsV2ForShareCode(normalizedCode);

  if (!shareData) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "공유 보드를 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  const section = shareData.sections.find((item) => item.id === sectionId);

  if (!section) {
    return jsonErrorWithRequestId(
      "SECTION_NOT_FOUND",
      "섹션을 찾을 수 없습니다.",
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
    const result = await listSectionCardsV2ForShare({
      sectionId: section.id,
      cursor,
      limit,
    });

    return jsonOkWithRequestId(
      {
        items: result.items.map((card) => ({
          id: card.id,
          sectionId: card.section_id,
          authorId: card.author_id,
          position: card.position,
          content: card.content,
          createdAt: card.created_at,
          updatedAt: card.updated_at,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; sectionId: string }> },
) {
  const { code, sectionId } = await params;
  const requestId = getOrCreateRequestId(request);
  const normalizedCode = normalizeShareCode(code);

  const body = (await request.json()) as {
    content?: WallV2CardContent;
    authorId?: string;
    turnstileToken?: string;
  };

  const shareData = await listSectionsV2ForShareCode(normalizedCode);

  if (!shareData) {
    return jsonErrorWithRequestId(
      "BOARD_NOT_FOUND",
      "공유 보드를 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

  if (shareData.board.class_state === "ended") {
    return jsonErrorWithRequestId("CLASS_ENDED", "수업이 종료되었습니다.", requestId, 403);
  }

  if (!shareData.board.share_write_enabled) {
    return jsonErrorWithRequestId(
      "WRITING_DISABLED",
      "지금은 글쓰기가 잠겨있습니다.",
      requestId,
      403,
    );
  }

  const section = shareData.sections.find((item) => item.id === sectionId);

  if (!section) {
    return jsonErrorWithRequestId(
      "SECTION_NOT_FOUND",
      "섹션을 찾을 수 없습니다.",
      requestId,
      404,
    );
  }

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
      "요청이 너무 빠릅니다.",
      requestId,
      429,
      undefined,
      { headers: { "Retry-After": `${retryAfter}` } },
    );
  }

  const cookieStore = await cookies();
  const bypass = await verifyBypassCookie(cookieStore);
  if (!bypass) {
    const ip = request.headers.get("cf-connecting-ip") ?? undefined;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const userAgent = request.headers.get("user-agent");
    const cfRay = request.headers.get("cf-ray");
    const verification = await verifyTurnstileTokenWithTelemetry(body.turnstileToken ?? "", {
      requestId,
      route: "/api/v2/share/:code/sections/:sectionId/cards",
      action: "share_card_create",
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
    const card = await createStudentCardV2({
      sectionId: section.id,
      content: body.content ?? { type: "text", text: "" },
      authorId: body.authorId,
    });

    return jsonOkWithRequestId({ cardId: card.id }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드 작성 실패";
    return jsonErrorWithRequestId("CREATE_FAILED", message, requestId, 400);
  }
}
