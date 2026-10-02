import { redactEduAiText } from "./aiRedaction";
import { resolveEduAiProviderMode } from "./aiProviderMode";
import { buildEduAiSafeFallback } from "./aiSafeFallback";
import type { EduAiRequest, EduAiResponse, EduAiProviderResult, EduAiTaskKind } from "./aiOrchestratorTypes";

const TASKS: EduAiTaskKind[] = ["explain", "improve", "verify", "summarize", "generate_hint", "coding_feedback", "courseware_reflection"];

export async function runEduAiOrchestrator(req: EduAiRequest, deps?: { provider?: (p: { prompt: string; taskKind: EduAiTaskKind; traceId: string }) => Promise<EduAiProviderResult> }): Promise<EduAiResponse> {
  const taskKind = TASKS.includes(req.taskKind) ? req.taskKind : null;
  const traceId = req.traceId ?? `edu-ai-${Date.now()}`;
  if (!taskKind) throw new Error("bad_request");
  const redaction = redactEduAiText(req.studentText);
  const safetyReasons: string[] = [];
  if (/폭탄|자해|kill/i.test(redaction.redactedText)) safetyReasons.push("safety_blocked_term");
  if (safetyReasons.length) {
    const fallback = buildEduAiSafeFallback(taskKind);
    return { ok: true, ...fallback, providerMode: "deterministic_safe", fallbackUsed: true, redaction: { applied: redaction.applied, categories: redaction.categories, counts: redaction.counts }, safety: { level: "blocked", reasons: safetyReasons }, traceId };
  }
  const mode = resolveEduAiProviderMode();
  if (mode === "server_llm" && deps?.provider) {
    const provider = await deps.provider({ prompt: redaction.redactedText, taskKind, traceId });
    if (provider.ok) return { ok: true, resultText: provider.text, providerMode: "server_llm", fallbackUsed: false, redaction: { applied: redaction.applied, categories: redaction.categories, counts: redaction.counts }, safety: { level: "classroom_safe", reasons: [] }, nextStudentAction: "답변을 보고 한 가지 수정하기", traceId };
  }
  const fallback = buildEduAiSafeFallback(taskKind);
  return { ok: true, ...fallback, providerMode: "deterministic_safe", fallbackUsed: true, redaction: { applied: redaction.applied, categories: redaction.categories, counts: redaction.counts }, safety: { level: "classroom_safe", reasons: [] }, traceId };
}
