import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { createUploadIntentForOwner, UploadIntentError } from "@/lib/data/files";
import { isAllowedCardAttachmentContentType } from "@/lib/data/safeAttachmentTypes";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicShareWriteGuard, resolvePublicShareBoard } from "@/lib/share/public/access";
import { shareCardUploadOwnershipSelect } from "@/lib/db/shareQueries";
import { validateCardAttachmentUploadPolicy } from "@/lib/uploads/cardAttachmentPolicy";
import { normalizeUploadContentType } from "@/lib/uploads/contentType";
import {
  createQ2B10UploadIntent,
  createQ4StudentComposeUpload,
  isQ2B10FixtureEnabled,
  isQ2B5StudentCardFixtureEnabled,
  Q2_B10_SHARE_CODE,
  Q2_B5_VALID_CODE,
  q2B10WriteGuard,
} from "@/lib/q2/browser/studentEntryFixture";

type InitiateBody = {
  clientId?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  originalBytes?: number;
  storedBytes?: number;
  originalSizeBytes?: number;
  optimizedSizeBytes?: number;
  width?: number | null;
  height?: number | null;
  optimized?: boolean;
  sha256Hex?: string | null;
  contentSha256?: string | null;
  optimizationFormat?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; cardId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { code, cardId } = await params;
    const body = (await request.json()) as InitiateBody;
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "clientId is required",
        requestId,
        400,
      );
    }

    if (isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B5_VALID_CODE) return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
      const intent = createQ4StudentComposeUpload(cardId);
      return intent ? jsonOkWithRequestId(intent, requestId) : jsonErrorWithRequestId("CARD_NOT_FOUND", "카드를 찾을 수 없습니다.", requestId, 404);
    }

    if (typeof body.filename !== "string" || body.filename.length === 0) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "filename is required",
        requestId,
        400,
      );
    }

    const normalizedContentType = normalizeUploadContentType({
      contentType: typeof body.contentType === "string" ? body.contentType : "",
      filename: body.filename,
    });

    if (!isAllowedCardAttachmentContentType(normalizedContentType)) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "unsupported contentType",
        requestId,
        400,
      );
    }

    if (typeof body.sizeBytes !== "number" || !Number.isFinite(body.sizeBytes) || body.sizeBytes <= 0) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "sizeBytes must be a positive number",
        requestId,
        400,
      );
    }

    const policyRejection = validateCardAttachmentUploadPolicy({
      filename: body.filename,
      contentType: normalizedContentType,
      sizeBytes: body.sizeBytes,
    });
    if (policyRejection) {
      return jsonErrorWithRequestId(
        policyRejection.code,
        policyRejection.message,
        requestId,
        policyRejection.status,
      );
    }

    if (isQ2B10FixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
      if (code.toLowerCase() !== Q2_B10_SHARE_CODE) {
        return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
      }
      const writeGuard = q2B10WriteGuard();
      if (!writeGuard.ok) {
        return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
      }
      const intent = createQ2B10UploadIntent({
        cardId,
        clientId,
        filename: body.filename,
        contentType: normalizedContentType,
      });
      return intent
        ? jsonOkWithRequestId(intent, requestId)
        : jsonErrorWithRequestId("CARD_NOT_FOUND", "카드를 찾을 수 없습니다.", requestId, 404);
    }

    const originalBytes =
      typeof body.originalBytes === "number" && Number.isFinite(body.originalBytes) && body.originalBytes > 0
        ? body.originalBytes
        : undefined;
    const storedBytes =
      typeof body.storedBytes === "number" && Number.isFinite(body.storedBytes) && body.storedBytes > 0
        ? body.storedBytes
        : undefined;
    const width =
      typeof body.width === "number" && Number.isFinite(body.width) && body.width > 0
        ? body.width
        : null;
    const height =
      typeof body.height === "number" && Number.isFinite(body.height) && body.height > 0
        ? body.height
        : null;
    const optimized = typeof body.optimized === "boolean" ? body.optimized : undefined;
    const sha256Hex = typeof body.sha256Hex === "string" && body.sha256Hex.length > 0 ? body.sha256Hex : null;
    const contentSha256 = typeof body.contentSha256 === "string" && body.contentSha256.length > 0 ? body.contentSha256 : null;

    const { board } = await resolvePublicShareBoard(code);

    if (!board) {
      return jsonErrorWithRequestId(
        "BOARD_NOT_FOUND",
        "공유 보드를 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    const writeGuard = getPublicShareWriteGuard(board);
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cards")
      .select(shareCardUploadOwnershipSelect)
      .eq("id", cardId)
      .single();

    if (error) {
      return jsonErrorWithRequestId(
        "SUPABASE_ERROR",
        error.message,
        requestId,
        400,
      );
    }

    const card = data as unknown as {
      id: string;
      ownerId: string;
      authorType: string | null;
      authorClientId: string | null;
      walls: { boardId: string } | null;
    } | null;

    if (!card || !card.walls || card.walls.boardId !== board.id) {
      return jsonErrorWithRequestId(
        "CARD_NOT_FOUND",
        "카드를 찾을 수 없습니다.",
        requestId,
        404,
      );
    }

    if (card.authorType !== "student") {
      return jsonErrorWithRequestId(
        "FORBIDDEN",
        "허용되지 않은 카드입니다.",
        requestId,
        403,
      );
    }

    if (!card.authorClientId || card.authorClientId !== clientId) {
      return jsonErrorWithRequestId(
        "FORBIDDEN",
        "허용되지 않은 요청입니다.",
        requestId,
        403,
      );
    }

    const intent = await createUploadIntentForOwner({
      supabase,
      ownerUserId: card.ownerId,
      cardId: card.id,
      filename: body.filename,
      contentType: normalizedContentType,
      sizeBytes: body.sizeBytes,
      originalBytes,
      storedBytes,
      originalSizeBytes: body.originalSizeBytes ?? originalBytes,
      optimizedSizeBytes: body.optimizedSizeBytes ?? storedBytes,
      width,
      height,
      optimized,
      sha256Hex,
      contentSha256: contentSha256 ?? sha256Hex,
      optimizationFormat: body.optimizationFormat ?? null,
    });

    return jsonOkWithRequestId(intent as Record<string, unknown>, requestId);
  } catch (error) {
    if (error instanceof UploadIntentError) {
      if (error.stage === "build_file_record" && error.message === "file_too_large") {
        return jsonErrorWithRequestId(
          "file_too_large",
          "파일이 너무 큽니다. 큰 파일은 드라이브 링크나 공식 다운로드 링크로 공유해 주세요.",
          requestId,
          413,
        );
      }
      if (error.stage === "build_file_record" && error.message === "total_storage_limit_exceeded") {
        return jsonErrorWithRequestId(
          "file_too_large",
          "저장 공간 한도를 초과했습니다. 큰 파일은 드라이브 링크나 공식 다운로드 링크로 공유해 주세요.",
          requestId,
          413,
        );
      }
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonErrorWithRequestId(
      "INITIATE_FAILED",
      message,
      requestId,
      400,
    );
  }
}
