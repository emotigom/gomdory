import type { EduAiProviderMode, EduAiRequest, EduAiSafetyLevel } from "@/lib/edu/ai/orchestrator/aiOrchestratorTypes";

export type AiLearningSpineAssistPayload = Pick<EduAiRequest, "taskKind" | "lessonId" | "selectedPromptChipId" | "artifactSummary" | "verificationContext"> & {
  studentText?: string | null;
  promptSummary?: string | null;
};

export type AiLearningSpineAssistUiResult = {
  ok: boolean;
  resultText: string;
  providerMode: EduAiProviderMode;
  fallbackUsed: boolean;
  redactionApplied: boolean;
  safetyLevel: EduAiSafetyLevel;
  nextStudentAction: string;
  teacherSignal?: string;
  errorCode?: "aborted" | "timeout" | "network" | "bad_response";
};

const DEFAULT_FALLBACK_TEXT = "도움말을 잠시 불러오지 못했어요. 체크리스트에서 한 가지를 골라 직접 검증해 보세요.";

export function buildAiLearningSpineAssistRequest(payload: AiLearningSpineAssistPayload): EduAiRequest {
  return {
    taskKind: payload.taskKind,
    lessonId: payload.lessonId ?? null,
    selectedPromptChipId: payload.selectedPromptChipId ?? null,
    studentText: payload.studentText ?? null,
    artifactSummary: payload.artifactSummary ?? payload.promptSummary ?? null,
    verificationContext: payload.verificationContext ?? null,
  };
}

export async function requestAiLearningSpineAssist(payload: AiLearningSpineAssistPayload, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<AiLearningSpineAssistUiResult> {
  const timeoutMs = opts?.timeoutMs ?? 6000;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort("timeout"), timeoutMs);
  const onAbort = () => abortController.abort("aborted");
  opts?.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch("/api/edu/ai/assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildAiLearningSpineAssistRequest(payload)),
      signal: abortController.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, resultText: DEFAULT_FALLBACK_TEXT, providerMode: "deterministic_safe", fallbackUsed: true, redactionApplied: false, safetyLevel: "classroom_safe", nextStudentAction: "근거를 한 줄로 써서 선생님과 확인하기", errorCode: "bad_response" };
    }
    const data = await response.json() as Record<string, unknown>;
    const redaction = (data.redaction && typeof data.redaction === "object") ? (data.redaction as Record<string, unknown>) : null;
    const safety = (data.safety && typeof data.safety === "object") ? (data.safety as Record<string, unknown>) : null;
    const safetyLevel = safety?.level;
    return {
      ok: Boolean(data.ok),
      resultText: typeof data.resultText === "string" ? data.resultText : DEFAULT_FALLBACK_TEXT,
      providerMode: data.providerMode === "server_llm" ? "server_llm" : "deterministic_safe",
      fallbackUsed: Boolean(data.fallbackUsed),
      redactionApplied: Boolean(redaction?.applied),
      safetyLevel: safetyLevel === "blocked" || safetyLevel === "needs_teacher_review" ? safetyLevel : "classroom_safe",
      nextStudentAction: typeof data.nextStudentAction === "string" ? data.nextStudentAction : "체크리스트에서 한 가지를 직접 검증하기",
      teacherSignal: typeof data.teacherSignal === "string" ? data.teacherSignal : undefined,
    };
  } catch (error) {
    const reason = String((error as { message?: string })?.message ?? "");
    const aborted = abortController.signal.aborted;
    const errorCode = aborted ? (String(abortController.signal.reason) === "timeout" ? "timeout" : "aborted") : "network";
    return { ok: false, resultText: DEFAULT_FALLBACK_TEXT, providerMode: "deterministic_safe", fallbackUsed: true, redactionApplied: false, safetyLevel: "classroom_safe", nextStudentAction: reason ? "잠시 후 다시 시도하고 검증 목록을 먼저 확인하기" : "체크리스트에서 한 가지를 직접 검증하기", errorCode };
  } finally {
    clearTimeout(timeoutId);
  }
}
