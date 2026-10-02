import { apiV1Path } from "@/lib/standards/pathTypes";
import { recordEduEvent } from "@/lib/edu/opsEvent";

export type EduAiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type EduAiChatResult =
  | {
      ok: true;
      message: string;
      requestId: string;
      latencyMs: number;
      status: number;
      modelHost?: string | null;
      startedAtMs: number;
      endedAtMs: number;
    }
  | {
      ok: false;
      requestId: string;
      latencyMs: number;
      errorCode: string;
      status?: number;
      modelHost?: string | null;
      startedAtMs: number;
      endedAtMs: number;
    };

type EduAiChatOptions = {
  lessonId?: number | null;
  anonId?: string | null;
  shareCode?: string | null;
  requestId?: string;
  messages: EduAiChatMessage[];
  timeoutMs?: number;
  signal?: AbortSignal;
  telemetryPath?: "chat_remote";
};

const DEFAULT_TIMEOUT_MS = 8000;

const createRequestId = () => {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const cryptoRef = globalThis.crypto as Crypto | undefined;
    if (cryptoRef?.randomUUID) {
      return `edu-ai-${cryptoRef.randomUUID()}`;
    }
  }
  return `edu-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeErrorCode = (status?: number, code?: string | null, aborted?: boolean) => {
  if (aborted) return "EDU_AI_TIMEOUT";
  if (code) return code;
  if (status === 429) return "EDU_AI_RATE_LIMITED";
  if (status && status >= 500) return "EDU_AI_REMOTE_FAILED";
  if (status === 400) return "EDU_AI_BAD_REQUEST";
  return "EDU_AI_REMOTE_FAILED";
};

export async function requestEduAiChat(options: EduAiChatOptions): Promise<EduAiChatResult> {
  const requestId = options.requestId ?? createRequestId();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAtMs = Date.now();
  const startTs = typeof performance === "undefined" ? startedAtMs : performance.now();
  let aborted = false;
  const telemetryPath = options.telemetryPath ?? "chat_remote";

  const handleAbort = () => {
    aborted = true;
    controller.abort();
  };
  if (options.signal) {
    if (options.signal.aborted) {
      handleAbort();
    } else {
      options.signal.addEventListener("abort", handleAbort, { once: true });
    }
  }

  try {
    const response = await fetch(apiV1Path("edu/ai/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-request-id": requestId,
      },
      signal: controller.signal,
      body: JSON.stringify({
        lessonId: options.lessonId ?? undefined,
        anonId: options.anonId ?? undefined,
        messages: options.messages,
      }),
    });

    const finalRequestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-gom-request-id") ??
      requestId;
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; message?: string; code?: string }
      | null;
    const latencyMs = Math.round(
      (typeof performance === "undefined" ? Date.now() : performance.now()) - startTs,
    );
    const endedAtMs = Date.now();
    const modelHost = response.headers.get("x-model-host");
    if (!response.ok || !payload?.ok || !payload.message) {
      const errorCode = normalizeErrorCode(response.status, payload?.code, aborted);
      void recordEduEvent({
        type: "EDU_AI_FALLBACK",
        boardId: "edu_ai_fallback",
        requestId: finalRequestId,
        shareCode: options.shareCode ?? undefined,
        extra: {
          ok: false,
          errorCode,
          path: telemetryPath,
          latencyMs,
          status: response.status ?? null,
        },
      });
      return {
        ok: false,
        requestId: finalRequestId,
        latencyMs,
        errorCode,
        status: response.status,
        modelHost,
        startedAtMs,
        endedAtMs,
      };
    }

    void recordEduEvent({
      type: "EDU_AI_FALLBACK",
      boardId: "edu_ai_fallback",
      requestId: finalRequestId,
      shareCode: options.shareCode ?? undefined,
      extra: {
        ok: true,
        path: telemetryPath,
        latencyMs,
        status: response.status ?? 200,
      },
    });

    return {
      ok: true,
      message: payload.message,
      requestId: finalRequestId,
      latencyMs,
      status: response.status,
      modelHost,
      startedAtMs,
      endedAtMs,
    };
  } catch {
    const latencyMs = Math.round(
      (typeof performance === "undefined" ? Date.now() : performance.now()) - startTs,
    );
    const endedAtMs = Date.now();
    const errorCode = normalizeErrorCode(undefined, null, aborted);
    void recordEduEvent({
      type: "EDU_AI_FALLBACK",
      boardId: "edu_ai_fallback",
      requestId,
      shareCode: options.shareCode ?? undefined,
      extra: {
        ok: false,
        errorCode,
        path: telemetryPath,
        latencyMs,
      },
    });
    return {
      ok: false,
      requestId,
      latencyMs,
      errorCode,
      startedAtMs,
      endedAtMs,
    };
  } finally {
    window.clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", handleAbort);
    }
  }
}
