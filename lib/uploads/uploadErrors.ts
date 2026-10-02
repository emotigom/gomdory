export type UploadErrorClassification = "network" | "forbidden" | "tooLarge" | "unsupportedType" | "unknown";

export type UploadErrorResponseHint = {
  status?: number;
  code?: string | null;
  message?: string | null;
  requestId?: string | null;
};

export type UploadErrorDiagnostics = {
  classification: UploadErrorClassification;
  debugToken: string;
  requestId?: string;
  status?: number;
  code?: string;
  rawMessage?: string;
};

function mapStageCodeToKoreanMessage(code?: string, stage?: string): string | null {
  const normalizedCode = (code ?? "").toLowerCase();
  const normalizedStage = (stage ?? "").toLowerCase();
  if (normalizedCode === "unsupported_file_type") return "설치 파일(.exe)은 보안상 첨부할 수 없어요. 공식 다운로드 링크를 카드에 붙여 주세요.";
  if (normalizedCode === "file_too_large") return "파일이 너무 큽니다. 50MB 이하 파일만 올리거나 드라이브 링크를 사용해 주세요.";
  if (normalizedCode === "upload_request_invalid") return "파일 정보를 확인할 수 없어요.";
  if (normalizedCode === "upload_auth_required") return "로그인이 필요해요.";
  if (normalizedCode === "upload_card_not_found") return "이 카드를 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.";
  if (normalizedCode === "upload_forbidden") return "이 카드에 파일을 추가할 권한이 없어요.";
  if (normalizedCode === "upload_file_record_failed") return "업로드 기록을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.";
  if (normalizedCode === "upload_storage_url_failed") return "파일 업로드 주소를 준비하지 못했어요.";
  if (normalizedCode === "upload_response_failed" || normalizedCode === "upload_initiate_unexpected") return "업로드 준비 중 문제가 생겼어요.";
  if (normalizedStage === "create_storage_upload_url") return "파일 업로드 주소를 준비하지 못했어요.";
  return null;
}

type UploadErrorWithDiagnostics = Error & { uploadDiagnostics?: UploadErrorDiagnostics };

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function makeDebugToken(): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `upload-${suffix}`;
}

export function classifyUploadError(err: unknown, resp?: UploadErrorResponseHint): UploadErrorClassification {
  const message =
    typeof resp?.message === "string"
      ? resp.message.toLowerCase()
      : err instanceof Error
        ? err.message.toLowerCase()
        : typeof err === "string"
          ? err.toLowerCase()
          : "";
  const code = (resp?.code ?? "").toLowerCase();
  const status = resp?.status;

  if (
    status === 401 ||
    status === 403 ||
    includesAny(code, ["forbidden", "unauthorized", "auth"]) ||
    includesAny(message, ["forbidden", "unauthorized", "권한"])
  ) {
    return "forbidden";
  }

  if (
    status === 413 ||
    includesAny(code, ["too_large", "payload_too_large", "entity_too_large", "size_limit", "file_too_large"]) ||
    includesAny(message, ["too large", "payload too large", "용량", "크기"])
  ) {
    return "tooLarge";
  }

  if (
    status === 415 ||
    includesAny(code, ["unsupported", "invalid_mime", "invalid_content_type", "unsupported_file_type"]) ||
    includesAny(message, ["unsupported", "content-type", "mime", "형식"])
  ) {
    return "unsupportedType";
  }

  if (
    err instanceof TypeError ||
    includesAny(message, ["network", "fetch", "failed to fetch", "네트워크", "xhr"]) ||
    status === 0
  ) {
    return "network";
  }

  return "unknown";
}

export function toUserMessage(classification: UploadErrorClassification): string {
  switch (classification) {
    case "network":
      return "네트워크 문제로 업로드에 실패했어요. 재시도해 주세요.";
    case "forbidden":
      return "업로드 권한이 없어 실패했어요. 재시도해 주세요.";
    case "tooLarge":
      return "파일이 너무 커서 업로드에 실패했어요. 더 작은 파일로 재시도해 주세요.";
    case "unsupportedType":
      return "지원되지 않는 파일 형식이라 업로드에 실패했어요.";
    default:
      return "업로드에 실패했어요. 재시도해 주세요.";
  }
}

export function createUploadError(err: unknown, resp?: UploadErrorResponseHint): UploadErrorWithDiagnostics {
  const classification = classifyUploadError(err, resp);
  const diagnostics: UploadErrorDiagnostics = {
    classification,
    debugToken: makeDebugToken(),
    requestId: resp?.requestId ?? undefined,
    status: resp?.status,
    code: resp?.code ?? undefined,
    rawMessage:
      typeof resp?.message === "string"
        ? resp.message
        : err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : undefined,
  };

  const stageAware = mapStageCodeToKoreanMessage(resp?.code ?? undefined, typeof resp?.message === "string" ? resp.message : undefined);
  const uploadError = new Error(stageAware ?? toUserMessage(classification)) as UploadErrorWithDiagnostics;
  uploadError.uploadDiagnostics = diagnostics;
  return uploadError;
}

export function getUploadErrorDiagnostics(err: unknown): UploadErrorDiagnostics | undefined {
  if (!err || typeof err !== "object") return undefined;
  return (err as UploadErrorWithDiagnostics).uploadDiagnostics;
}
