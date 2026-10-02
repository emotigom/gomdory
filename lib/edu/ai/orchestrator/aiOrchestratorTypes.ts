export type EduAiTaskKind =
  | "explain"
  | "improve"
  | "verify"
  | "summarize"
  | "generate_hint"
  | "coding_feedback"
  | "courseware_reflection";

export type EduAiProviderMode = "deterministic_safe" | "server_llm" | "local_webllm_hint";
export type EduAiSafetyLevel = "classroom_safe" | "blocked" | "needs_teacher_review";

export type EduAiErrorCode = "bad_request" | "provider_timeout" | "provider_upstream" | "provider_unavailable";

export type EduAiRedactionCategory = "email" | "phone" | "name" | "school_info" | "token" | "url_query" | "long_id";

export type EduAiRedactionResult = {
  redactedText: string;
  applied: boolean;
  categories: EduAiRedactionCategory[];
  counts: Partial<Record<EduAiRedactionCategory, number>>;
};

export type EduAiRequest = {
  taskKind: EduAiTaskKind;
  lessonId?: string | number | null;
  studentText?: string | null;
  artifactSummary?: string | null;
  selectedPromptChipId?: string | null;
  verificationContext?: string | null;
  traceId?: string;
};

export type EduAiProviderResult = { ok: true; text: string } | { ok: false; errorCode: EduAiErrorCode };

export type EduAiResponse = {
  ok: boolean;
  resultText: string;
  providerMode: EduAiProviderMode;
  fallbackUsed: boolean;
  redaction: Omit<EduAiRedactionResult, "redactedText">;
  safety: { level: EduAiSafetyLevel; reasons: string[] };
  nextStudentAction: string;
  teacherSignal?: string;
  traceId: string;
};
