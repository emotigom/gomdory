import "server-only";

export type StudentRecordsProviderErrorCode =
  | "PROVIDER_DISABLED"
  | "PROVIDER_CONFIGURATION"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT_UNKNOWN"
  | "PROVIDER_REFUSED"
  | "PROVIDER_INCOMPLETE"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "INVALID_INPUT";

export type StudentRecordsProviderSafeCategory =
  | "missing-runtime-config"
  | "authentication-rejected"
  | "project-permission-rejected"
  | "unsupported-region"
  | "model-unavailable"
  | "request-schema-invalid"
  | "unknown-configuration";

export type StudentRecordsProviderFailureDiagnostic = {
  requestId: string;
  upstreamStatus?: number;
  safeCategory: StudentRecordsProviderSafeCategory;
  safeErrorCode: string;
  latency: number;
  modelId?: string;
};

export class StudentRecordsProviderError extends Error {
  constructor(
    public readonly code: StudentRecordsProviderErrorCode,
    public readonly retryAfterSeconds?: number,
    public readonly diagnostic?: StudentRecordsProviderFailureDiagnostic,
  ) {
    super(code);
  }
}

export function safeProviderErrorMessage(code: StudentRecordsProviderErrorCode): string {
  if (code === "PROVIDER_DISABLED") return "현재 AI 문구 생성 기능이 비활성화되어 있습니다.";
  if (code === "PROVIDER_CONFIGURATION") return "AI 문구 생성 설정을 확인해야 합니다.";
  if (code === "PROVIDER_RATE_LIMITED") return "요청이 많습니다. 잠시 후 직접 다시 시도해주세요.";
  if (code === "PROVIDER_TIMEOUT_UNKNOWN") return "응답을 받지 못했지만 생성이 완료되었을 가능성이 있습니다. 다시 시도하면 추가 사용량이 발생할 수 있습니다.";
  if (code === "PROVIDER_REFUSED") return "입력 내용을 바탕으로 문구를 생성할 수 없습니다.";
  if (code === "PROVIDER_INCOMPLETE") return "생성 응답이 완료되지 않았습니다. 입력을 검토한 뒤 다시 시도해주세요.";
  if (code === "INVALID_OUTPUT") return "생성 결과를 확인하지 못했습니다.";
  if (code === "INVALID_INPUT") return "입력 내용을 다시 확인해주세요.";
  return "현재 문구 생성 서비스를 사용할 수 없습니다.";
}
