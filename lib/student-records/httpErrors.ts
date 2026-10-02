type HttpErrorMessageOptions = {
  accessMode?: "authenticated" | "guest";
  code?: string;
};

export class StudentRecordsHttpError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
  }
}

export function safeHttpErrorMessage(status: number, options: HttpErrorMessageOptions = {}): string {
  if (status === 400) return "생성 요청 형식을 확인하지 못했습니다. 입력 내용을 다시 확인해주세요.";
  if (status === 401 && options.accessMode === "guest") return "체험 링크가 만료되었거나 유효하지 않습니다. 초대 링크를 다시 열어주세요.";
  if (status === 401) return "로그인이 만료되었습니다. 다시 로그인해주세요.";
  if (status === 403) return "이 도구를 사용할 권한을 확인하지 못했습니다.";
  if (status === 413) return "한 번에 보낸 입력이 너무 큽니다. 입력 내용을 줄여주세요.";
  if (status === 429) return "요청이 많습니다. 잠시 후 직접 다시 시도해주세요.";
  if (status >= 500 && status <= 599) return "생성 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
  return "입력 내용을 다시 확인해주세요.";
}

export function isRetryableHttpError(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

const RETRYABLE_GENERATION_CODES = new Set([
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT_UNKNOWN",
  "PROVIDER_INCOMPLETE",
  "PROVIDER_UNAVAILABLE",
]);

export function isRetryableGenerationCode(code: string): boolean {
  return RETRYABLE_GENERATION_CODES.has(code);
}

export const NETWORK_ERROR_MESSAGE = "서버에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.";
export function safeGenerationCodeMessage(code: string): string {
  if (code === "PROVIDER_DISABLED") return "현재 AI 문구 생성 기능이 비활성화되어 있습니다.";
  if (code === "PROVIDER_CONFIGURATION") return "AI 문구 생성 설정을 확인해야 합니다.";
  if (code === "PROVIDER_RATE_LIMITED") return "요청이 많습니다. 잠시 후 직접 다시 시도해주세요.";
  if (code === "PROVIDER_TIMEOUT_UNKNOWN") return "응답을 받지 못했지만 생성이 완료되었을 가능성이 있습니다. 다시 시도하면 추가 사용량이 발생할 수 있습니다.";
  if (code === "PROVIDER_REFUSED") return "입력 내용을 바탕으로 문구를 생성할 수 없습니다.";
  if (code === "PROVIDER_INCOMPLETE") return "생성 응답이 완료되지 않았습니다.";
  if (code === "INVALID_OUTPUT") return "생성 결과를 확인하지 못했습니다.";
  if (code === "PROVIDER_UNAVAILABLE") return "현재 문구 생성 서비스를 사용할 수 없습니다.";
  return code === "INVALID_INPUT" ? "입력 내용을 다시 확인해주세요." : "생성 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
