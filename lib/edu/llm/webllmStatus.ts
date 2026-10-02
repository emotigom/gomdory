import type { ModelRecord } from "@mlc-ai/web-llm";

export type WebLLMStatus =
  | "DISABLED"
  | "UNSUPPORTED"
  | "ENV_MISSING"
  | "MODEL_ID_UNKNOWN"
  | "ASSET_UNREACHABLE"
  | "CORS_BLOCKED"
  | "LOADING"
  | "READY"
  | "DEGRADED"
  | "ERROR";

export type WebLLMStatusDescriptor = {
  status: WebLLMStatus;
  code: string;
  studentMessage: string;
  teacherMessage: string;
  teacherAction: string;
};

const STATUS_COPY: Record<WebLLMStatus, Omit<WebLLMStatusDescriptor, "status">> = {
  DISABLED: {
    code: "WEBLLM_DISABLED",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "WebLLM이 비활성화되어 있어요.",
    teacherAction: "운영 모드에서 AI 사용을 다시 켜세요.",
  },
  UNSUPPORTED: {
    code: "WEBLLM_UNSUPPORTED",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "이 기기에서는 WebLLM을 사용할 수 없어요.",
    teacherAction: "브라우저/기기에서 하드웨어 가속을 켜거나 다른 기기를 사용하세요.",
  },
  ENV_MISSING: {
    code: "WEBLLM_ENV_MISSING",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "WebLLM 환경 변수가 비어 있어요.",
    teacherAction: "모델 ID/BASE/LIB 환경 변수를 확인하세요.",
  },
  MODEL_ID_UNKNOWN: {
    code: "WEBLLM_MODEL_ID_UNKNOWN",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "설정된 모델 ID가 prebuilt 목록에 없어요.",
    teacherAction: "지원 모델 ID로 변경하거나 자동 대체 모델을 확인하세요.",
  },
  ASSET_UNREACHABLE: {
    code: "WEBLLM_ASSET_UNREACHABLE",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "모델/와즘 파일에 접근할 수 없어요.",
    teacherAction: "R2 경로와 업로드 상태를 확인하세요.",
  },
  CORS_BLOCKED: {
    code: "WEBLLM_CORS_BLOCKED",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "브라우저에서 모델 파일 요청이 차단되었어요.",
    teacherAction: "배포 도메인에서 모델 호스트의 CORS(HEAD/GET)를 허용하세요.",
  },
  LOADING: {
    code: "WEBLLM_LOADING",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "WebLLM이 초기화 중이에요.",
    teacherAction: "초기화가 오래 걸리면 네트워크/캐시 상태를 확인하세요.",
  },
  READY: {
    code: "WEBLLM_READY",
    studentMessage: "",
    teacherMessage: "WebLLM이 준비되었습니다.",
    teacherAction: "",
  },
  DEGRADED: {
    code: "WEBLLM_DEGRADED",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "WebLLM 실패가 반복되어 임시 폴백 모드예요.",
    teacherAction: "5분 후 재시도하거나 설정/네트워크를 점검하세요.",
  },
  ERROR: {
    code: "WEBLLM_ERROR",
    studentMessage: "지금은 다른 방법으로 도와줄게요.",
    teacherMessage: "WebLLM 오류가 발생했어요.",
    teacherAction: "자가진단을 실행해 원인과 해결책을 확인하세요.",
  },
};

const RECOMMENDED_MODEL_ALLOWLIST = [
  "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Phi-3-mini-4k-instruct-q4f16_1-MLC",
  "Llama-3.1-8B-Instruct-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC",
  "gemma-2b-it-q4f16_1-MLC",
];

export const getWebLLMStatusDescriptor = (status: WebLLMStatus): WebLLMStatusDescriptor => {
  const payload = STATUS_COPY[status];
  return {
    status,
    ...payload,
  };
};

export function selectPreferredWebLLMModel(
  list: ModelRecord[] | null | undefined,
  preferredId: string,
): { modelId: string | null; autoSelected: boolean; reason?: string } {
  if (!Array.isArray(list) || list.length === 0) {
    return { modelId: null, autoSelected: false };
  }
  const preferredMatch = list.find((item) => item.model_id === preferredId);
  if (preferredMatch) {
    return { modelId: preferredId, autoSelected: false };
  }
  for (const allowId of RECOMMENDED_MODEL_ALLOWLIST) {
    const match = list.find((item) => item.model_id === allowId);
    if (match) {
      return { modelId: match.model_id, autoSelected: true, reason: "allowlist" };
    }
  }
  return { modelId: list[0]?.model_id ?? null, autoSelected: true, reason: "fallback_first" };
}
