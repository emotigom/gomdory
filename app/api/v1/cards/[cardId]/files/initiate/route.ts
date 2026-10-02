import { createUploadIntentForOwner, UploadIntentError } from "@/lib/data/files";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isAllowedCardAttachmentContentType } from "@/lib/data/safeAttachmentTypes";
import { validateCardAttachmentUploadPolicy } from "@/lib/uploads/cardAttachmentPolicy";
import { getFileExtension, normalizeUploadContentType } from "@/lib/uploads/contentType";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getRuntimeEnv } from "@/lib/server/runtimeEnv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InitiateBody = {
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

type InitiateStage =
  | "route_start"
  | "parse_request"
  | "resolve_auth_user"
  | "load_card"
  | "authorize_card_upload"
  | "normalize_upload_metadata"
  | "build_storage_key"
  | "create_file_row"
  | "create_storage_upload_url"
  | "build_success_response"
  | "build_error_response";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const ROUTE_HEADERS = {
    "x-gom-upload-initiate-version": "stage-v2",
    "x-gom-upload-initiate-route": "cards-files-initiate",
  } as const;
  const withRouteHeaders = (init?: ResponseInit) => ({
    ...init,
    headers: {
      ...ROUTE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
  const routeError = (
    code: string,
    message: string,
    stage: string,
    status: number,
    requestId: string,
  ) =>
    jsonErrorWithRequestId(code, message, requestId, status, {
      error: { code, message, stage },
    }, withRouteHeaders());
  const policyError = (
    code: string,
    message: string,
    status: number,
    requestId: string,
  ) =>
    jsonErrorWithRequestId(code, message, requestId, status, undefined, withRouteHeaders());

  const requestId = getOrCreateRequestId(req);
  let lastKnownStage: InitiateStage = "route_start";
  let cardIdForLog: string | null = null;
  let hasAuthUser = false;
  let ownerUserIdPresent = false;
  let insertedFileId: string | null = null;
  let bodyForLog: InitiateBody | null = null;

  const logError = (code: string, status: number, safeMessage: string, errorStage: string, error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    const errorName = error instanceof Error ? error.name : typeof error;
    const safeErrorCode =
      typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    const supabaseCode =
      typeof error === "object" && error && "supabaseCode" in error && typeof (error as { supabaseCode?: unknown }).supabaseCode === "string"
        ? (error as { supabaseCode: string }).supabaseCode
        : undefined;

    console.error("[cards.files.initiate] stage_failure", {
      route: "cards-files-initiate",
      requestId,
      cardId: cardIdForLog,
      lastKnownStage,
      hasAuthUser,
      ownerUserIdPresent,
      hasFileName: Boolean(bodyForLog?.filename),
      hasContentType: Boolean(bodyForLog?.contentType),
      hasSizeBytes: typeof bodyForLog?.sizeBytes === "number",
      errorCode: code,
      errorName,
      errorMessage: message,
      safeErrorCode,
      supabaseCode,
      canaryHeadersPresent: {
        version: Boolean(ROUTE_HEADERS["x-gom-upload-initiate-version"]),
        route: Boolean(ROUTE_HEADERS["x-gom-upload-initiate-route"]),
      },
      hasStorageBucket: Boolean(getRuntimeEnv().R2_BUCKET),
      insertedFileId,
      stackFirstLine: error instanceof Error ? error.stack?.split("\n")[0] ?? null : null,
    });
    return routeError(code, safeMessage, errorStage, status, requestId);
  };

  try {
    lastKnownStage = "parse_request";
    const { cardId } = await params;
    cardIdForLog = cardId;
    const body = (await req.json()) as InitiateBody;
    bodyForLog = body;

    if (typeof body.filename !== "string" || body.filename.length === 0) {
      return routeError("upload_request_invalid", "Invalid upload request", "parse_request", 400, requestId);
    }

    const normalizedContentType = normalizeUploadContentType({
      contentType: typeof body.contentType === "string" ? body.contentType : "",
      filename: body.filename,
    });

    if (!isAllowedCardAttachmentContentType(normalizedContentType)) {
      return routeError("upload_request_invalid", "Invalid upload request", "parse_request", 400, requestId);
    }

    const sizeBytes =
      typeof body.sizeBytes === "number"
        ? body.sizeBytes
        : typeof body.storedBytes === "number"
          ? body.storedBytes
          : typeof body.originalSizeBytes === "number"
            ? body.originalSizeBytes
            : undefined;

    if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return routeError("upload_request_invalid", "Invalid upload request", "parse_request", 400, requestId);
    }

    const policyRejection = validateCardAttachmentUploadPolicy({
      filename: body.filename,
      contentType: normalizedContentType,
      sizeBytes,
    });
    if (policyRejection) {
      console.info("[cards.files.initiate] policy_rejected", {
        requestId,
        cardId,
        code: policyRejection.code,
        status: policyRejection.status,
        filename: body.filename,
        extension: getFileExtension(body.filename),
        normalizedContentType,
        sizeBytes,
        maxBytes: "maxBytes" in policyRejection ? policyRejection.maxBytes : undefined,
      });
      return policyError(
        policyRejection.code,
        policyRejection.message,
        policyRejection.status,
        requestId,
      );
    }

    lastKnownStage = "resolve_auth_user";
    const { user } = await requireUserApi();
    hasAuthUser = true;
    ownerUserIdPresent = Boolean(user.id);

    lastKnownStage = "normalize_upload_metadata";
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

    lastKnownStage = "build_storage_key";
    const intent = await createUploadIntentForOwner({
      supabase: createSupabaseServerClient(),
      ownerUserId: user.id,
      cardId,
      filename: body.filename,
      contentType: normalizedContentType,
      sizeBytes,
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
      authzDiagnostics: (details) => {
        console.info("[cards.files.initiate] authorize_card_upload", {
          requestId,
          stage: "authorize_card_upload",
          cardId: details.cardId,
          wallIdPresent: details.wallIdPresent,
          boardIdPresent: details.boardIdPresent,
          authUserIdPresent: details.authUserIdPresent,
          ownerIdEqualsAuthUserId: details.ownerIdEqualsAuthUserId,
          boardOwnerIdPresent: details.boardOwnerIdPresent,
          boardOwnerIdEqualsAuthUserId: details.boardOwnerIdEqualsAuthUserId,
          boardRoleResult: details.boardRoleResult,
          boardMembersRoleResult: details.boardMembersRoleResult,
          authorizationDecision: details.authorizationDecision,
          forbiddenReason: details.forbiddenReason,
        });
      },
    });
    insertedFileId = intent.fileId;
    console.info("[cards.files.initiate] accepted", {
      requestId,
      stage: "normalize_upload_metadata",
      fileId: intent.fileId,
      filename: body.filename,
      extension: getFileExtension(body.filename ?? ""),
      normalizedContentType,
      sizeBytes,
      r2KeyPresent: Boolean(intent.r2Key),
      deduped: intent.deduped,
    });

    lastKnownStage = "build_success_response";
    try {
      return jsonOkWithRequestId(intent, requestId, withRouteHeaders());
    } catch (error) {
      return logError("upload_response_failed", 500, "Upload response failed", "build_success_response", error);
    }
  } catch (error) {
    lastKnownStage = lastKnownStage ?? "build_error_response";
    if (error instanceof UploadIntentError) {
      if (error.stage === "load_card") return logError("upload_card_not_found", 404, "Card not found", "load_card", error);
      if (error.stage === "authorize_card_upload") return logError("upload_forbidden", 403, "Forbidden", "authorize_card_upload", error);
      if (error.stage === "create_storage_upload_url") return logError("upload_storage_url_failed", 500, "Upload storage URL failed", "create_storage_upload_url", error);
      if (error.stage === "create_file_row") return logError("upload_file_record_failed", 500, "Upload file record failed", "create_file_row", error);
      if (error.stage === "build_file_record" && error.message === "file_too_large") {
        return policyError("file_too_large", "파일이 너무 큽니다. 큰 파일은 드라이브 링크나 공식 다운로드 링크로 공유해 주세요.", 413, requestId);
      }
      if (error.stage === "build_file_record" && error.message === "total_storage_limit_exceeded") {
        return policyError("file_too_large", "저장 공간 한도를 초과했습니다. 큰 파일은 드라이브 링크나 공식 다운로드 링크로 공유해 주세요.", 413, requestId);
      }
      if (error.stage === "build_file_record") return logError("upload_file_record_failed", 500, "Upload file record failed", "build_storage_key", error);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "unauthorized") {
      return logError("upload_auth_required", 401, "Unauthorized", "resolve_auth_user", error);
    }
    if (message === "sizeBytes must be a positive number" || message.includes("초과")) {
      return logError("upload_request_invalid", 400, "Invalid upload request", "normalize_upload_metadata", error);
    }

    return logError("upload_initiate_unexpected", 500, "Upload initiate unexpected", lastKnownStage || "unexpected", error);
  }
}
