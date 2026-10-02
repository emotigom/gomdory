import { abort as abortWebLLM, start as startWebLLM } from "@/lib/edu/llm/webllmWorkerBridge";
import {
  containsAwkwardKorean,
  containsHan,
  detectKana,
  explainHanFound,
} from "@/lib/edu/text/koreanGuard";

export type KoreanRewriteResult = {
  status: "skipped" | "rewritten" | "blocked";
  text: string;
  hadIssues: boolean;
};

type KoreanRewriteOptions = {
  text: string;
  systemPrompt: string;
  preferredModelId?: string;
  temperature?: number;
  timeoutMs?: number;
};

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_TIMEOUT_MS = 120000;
const createRequestId = () => {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoRef = globalThis.crypto as Crypto | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export async function rewriteKoreanOnce({
  text,
  systemPrompt,
  preferredModelId,
  temperature = DEFAULT_TEMPERATURE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: KoreanRewriteOptions): Promise<KoreanRewriteResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: "skipped", text: trimmed, hadIssues: false };
  }

  const hasHan = containsHan(trimmed);
  const hasAwkward = containsAwkwardKorean(trimmed);
  const hasKana = detectKana(trimmed);
  if (!hasHan && !hasAwkward && !hasKana) {
    return { status: "skipped", text: trimmed, hadIssues: false };
  }

  const sample = explainHanFound(trimmed);
  if (process.env.NODE_ENV !== "production" && sample.found) {
    console.warn("[edu] 한자 감지 (rewrite):", sample.sample);
  }

  const rewriteInstruction = [
    "아래 문장을 한글만 사용해서 자연스럽게 다시 써줘.",
    "한자/중국어/일본어 문자와 가나 금지. '수영자' 같은 표현 금지.",
    "",
    "[원문]",
    trimmed,
  ].join("\n");

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const requestId = createRequestId();
  const abortHandler = () => abortWebLLM(requestId);
  controller.signal.addEventListener("abort", abortHandler);
  const response = await startWebLLM(requestId, {
    kind: "completeText",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: rewriteInstruction },
    ],
    temperature,
    preferredModelId,
  });
  controller.signal.removeEventListener("abort", abortHandler);
  globalThis.clearTimeout(timeoutId);

  if (response.type !== "result" || response.kind !== "completeText" || !response.result.ok) {
    return { status: "blocked", text: trimmed, hadIssues: true };
  }

  const rewritten = response.result.content.trim();
  if (
    !rewritten ||
    containsHan(rewritten) ||
    containsAwkwardKorean(rewritten) ||
    detectKana(rewritten)
  ) {
    if (process.env.NODE_ENV !== "production") {
      const rewrittenSample = explainHanFound(rewritten);
      console.warn("[edu] 재작성 실패 (rewrite):", rewrittenSample.sample ?? rewritten);
    }
    return { status: "blocked", text: trimmed, hadIssues: true };
  }

  return { status: "rewritten", text: rewritten, hadIssues: true };
}
