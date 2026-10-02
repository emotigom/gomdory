export type WebLLMModelSmokeStage =
  | "idle"
  | "loading-package"
  | "selecting-model"
  | "loading-model"
  | "running-prompt"
  | "complete"
  | "failed";

export type WebLLMModelSmokeErrorCategory =
  | "브라우저 미지원"
  | "모델 후보 없음"
  | "모델 로드 실패"
  | "메모리 부족 가능성"
  | "실행 중 오류"
  | "알 수 없는 오류";

export type WebLLMModelSmokeModelSource = "prebuilt-webllm" | "gomdory-r2" | "fallback-prebuilt-after-gomdory-failure";

export type WebLLMModelSmokeResult = {
  smokeStatus: "complete" | "failed";
  selectedModelId: string | null;
  packageLoadMs: number | null;
  modelLoadMs: number | null;
  firstTokenLatencyMs: number | null;
  totalRunMs: number | null;
  generatedTokenEstimate: number | null;
  tokensPerSecond: number | null;
  errorCode: string | null;
  errorMessageCategory: WebLLMModelSmokeErrorCategory | null;
  modelSource: WebLLMModelSmokeModelSource;
  manifestUrl: string | null;
  manifestLoadMs: number | null;
  manifestModelCount: number | null;
  modelOrigin: string | null;
  gomdoryFallbackReason: string | null;
};

export type WebLLMModelSmokeProgress = {
  stage: WebLLMModelSmokeStage;
  message: string;
};
