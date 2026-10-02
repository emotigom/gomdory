/// <reference lib="webworker" />

import {
  completeLocalWebLLMText,
  disposeAllLocalWebLLMEngines,
  generateLocalWebLLMJson,
  getLocalWebLLMDiagnostics,
  recordInsuranceTemplateApplied,
  resetLocalWebLLMEngine,
  streamLocalWebLLMChat,
  warmupLocalWebLLMEngine,
} from "./localWebllm";
import type {
  WebLLMWorkerInput,
  WebLLMWorkerProgressEvent,
  WebLLMWorkerRequest,
  WebLLMWorkerResponse,
} from "./webllmWorkerTypes";

type ActiveRequest = {
  controller: AbortController;
  kind: WebLLMWorkerInput["kind"];
  tokenCount: number;
  longWaitTimer: number | null;
  longWaitSent: boolean;
  aborted: boolean;
  abortedNotified: boolean;
};

const LONG_WAIT_MS = 8000;
const PREPARING_MESSAGE = "준비 중…";
const THINKING_MESSAGE = "생각 중…";
const APPLYING_MESSAGE = "결과를 정리 중…";
const LONG_WAIT_MESSAGE = "지금 기기에서 만드는 중";

const activeRequests = new Map<string, ActiveRequest>();
let engineCleanupPromise: Promise<void> | null = null;

const settleCleanupTick = async () => {
  await Promise.resolve();
};

const runEngineCleanup = async () => {
  if (engineCleanupPromise) {
    await engineCleanupPromise;
    return;
  }
  engineCleanupPromise = (async () => {
    await settleCleanupTick();
    try {
      await disposeAllLocalWebLLMEngines();
    } catch {
      // ignore cleanup failures
    }
  })();
  try {
    await engineCleanupPromise;
  } finally {
    engineCleanupPromise = null;
  }
};

const postMessageSafe = (payload: WebLLMWorkerResponse) => {
  (self as DedicatedWorkerGlobalScope).postMessage(payload);
};

const emitProgress = (
  requestId: string,
  kind: WebLLMWorkerInput["kind"],
  stage: WebLLMWorkerProgressEvent["stage"],
  message: string,
  extra?: Pick<WebLLMWorkerProgressEvent, "tokenCount" | "delta">,
) => {
  postMessageSafe({
    type: "progress",
    requestId,
    kind,
    stage,
    message,
    ...extra,
  });
};

const scheduleLongWait = (requestId: string, kind: WebLLMWorkerInput["kind"]) => {
  return (self as DedicatedWorkerGlobalScope).setTimeout(() => {
    const entry = activeRequests.get(requestId);
    if (!entry || entry.longWaitSent || entry.aborted || entry.controller.signal.aborted) return;
    entry.longWaitSent = true;
    emitProgress(requestId, kind, "thinking", LONG_WAIT_MESSAGE);
  }, LONG_WAIT_MS);
};

const countTokens = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

const finalizeRequest = (requestId: string) => {
  const entry = activeRequests.get(requestId);
  if (!entry) return;
  if (entry.longWaitTimer) {
    (self as DedicatedWorkerGlobalScope).clearTimeout(entry.longWaitTimer);
  }
  activeRequests.delete(requestId);
};

const handleStart = async (requestId: string, input: WebLLMWorkerInput) => {
  const existing = activeRequests.get(requestId);
  if (existing) {
    existing.aborted = true;
    existing.controller.abort();
    finalizeRequest(requestId);
  }

  const controller = new AbortController();
  const entry: ActiveRequest = {
    controller,
    kind: input.kind,
    tokenCount: 0,
    longWaitTimer: null,
    longWaitSent: false,
    aborted: false,
    abortedNotified: false,
  };
  activeRequests.set(requestId, entry);

  if (input.kind !== "reset" && input.kind !== "diagnostics" && input.kind !== "recordInsurance") {
    emitProgress(requestId, input.kind, "preparing", PREPARING_MESSAGE);
    entry.longWaitTimer = scheduleLongWait(requestId, input.kind);
  }

  try {
    switch (input.kind) {
      case "streamChat": {
        emitProgress(requestId, input.kind, "thinking", THINKING_MESSAGE);
        const result = await streamLocalWebLLMChat({
          messages: input.messages,
          temperature: input.temperature,
          preferredModelId: input.preferredModelId,
          stallTimeoutMs: input.stallTimeoutMs,
          signal: controller.signal,
          onProgress: (message) => emitProgress(requestId, input.kind, "loading", message),
          onChunk: (chunk) => {
            const entry = activeRequests.get(requestId);
            if (!entry || entry.aborted || entry.controller.signal.aborted) return;
            entry.tokenCount += countTokens(chunk);
            emitProgress(requestId, input.kind, "thinking", THINKING_MESSAGE, {
              delta: chunk,
              tokenCount: entry.tokenCount,
            });
          },
        });

        if (controller.signal.aborted || entry.aborted) {
          if (!entry.abortedNotified) {
            postMessageSafe({ type: "aborted", requestId, kind: input.kind });
            entry.abortedNotified = true;
          }
          return;
        }

        emitProgress(requestId, input.kind, "applying", APPLYING_MESSAGE);
        postMessageSafe({ type: "result", requestId, kind: input.kind, result });
        return;
      }
      case "generateJson": {
        emitProgress(requestId, input.kind, "thinking", THINKING_MESSAGE);
        const result = await generateLocalWebLLMJson({
          messages: input.messages,
          schema: input.schema,
          temperature: input.temperature,
          preferredModelId: input.preferredModelId,
          timeoutMs: input.timeoutMs,
          engineTimeoutMs: input.engineTimeoutMs,
          useResponseFormat: input.useResponseFormat,
          maxTokens: input.maxTokens,
          signal: controller.signal,
          onProgress: (message) => emitProgress(requestId, input.kind, "loading", message),
        });

        if (controller.signal.aborted || entry.aborted) {
          if (!entry.abortedNotified) {
            postMessageSafe({ type: "aborted", requestId, kind: input.kind });
            entry.abortedNotified = true;
          }
          return;
        }

        if (!result.ok && result.reason === "timeout") {
          await runEngineCleanup();
        }
        emitProgress(requestId, input.kind, "applying", APPLYING_MESSAGE);
        postMessageSafe({ type: "result", requestId, kind: input.kind, result });
        return;
      }
      case "completeText": {
        emitProgress(requestId, input.kind, "thinking", THINKING_MESSAGE);
        const result = await completeLocalWebLLMText({
          messages: input.messages,
          temperature: input.temperature,
          preferredModelId: input.preferredModelId,
          signal: controller.signal,
        });

        if (controller.signal.aborted || entry.aborted) {
          if (!entry.abortedNotified) {
            postMessageSafe({ type: "aborted", requestId, kind: input.kind });
            entry.abortedNotified = true;
          }
          return;
        }

        emitProgress(requestId, input.kind, "applying", APPLYING_MESSAGE);
        postMessageSafe({ type: "result", requestId, kind: input.kind, result });
        return;
      }
      case "warmup": {
        const result = await warmupLocalWebLLMEngine({
          preferredModelId: input.preferredModelId,
          signal: controller.signal,
          onProgress: (message) => emitProgress(requestId, input.kind, "loading", message),
        });
        if (controller.signal.aborted || entry.aborted) {
          if (!entry.abortedNotified) {
            postMessageSafe({ type: "aborted", requestId, kind: input.kind });
            entry.abortedNotified = true;
          }
          return;
        }
        emitProgress(requestId, input.kind, "applying", APPLYING_MESSAGE);
        postMessageSafe({ type: "result", requestId, kind: input.kind, result });
        return;
      }
      case "reset": {
        await resetLocalWebLLMEngine(input.scope);
        postMessageSafe({ type: "result", requestId, kind: input.kind, result: { ok: true } });
        return;
      }
      case "diagnostics": {
        const result = getLocalWebLLMDiagnostics();
        postMessageSafe({ type: "result", requestId, kind: input.kind, result });
        return;
      }
      case "recordInsurance": {
        recordInsuranceTemplateApplied();
        postMessageSafe({ type: "result", requestId, kind: input.kind, result: { ok: true } });
        return;
      }
      default: {
        postMessageSafe({
          type: "error",
          requestId,
          error: { message: "지원하지 않는 요청입니다." },
        });
      }
    }
  } catch (error) {
    if (controller.signal.aborted || entry.aborted) {
      if (!entry.abortedNotified) {
        postMessageSafe({ type: "aborted", requestId, kind: input.kind });
        entry.abortedNotified = true;
      }
      return;
    }
    postMessageSafe({
      type: "error",
      requestId,
      kind: input.kind,
      error: { message: error instanceof Error ? error.message : "요청에 실패했습니다." },
    });
  } finally {
    const shouldCleanup = entry.aborted || controller.signal.aborted;
    finalizeRequest(requestId);
    if (shouldCleanup) {
      await runEngineCleanup();
    }
  }
};

(self as DedicatedWorkerGlobalScope).addEventListener("message", (event) => {
  const data = event.data as WebLLMWorkerRequest;
  if (!data || typeof data !== "object") return;

  if (data.type === "abort") {
    const entry = activeRequests.get(data.requestId);
    if (entry) {
      entry.aborted = true;
      entry.abortedNotified = true;
      entry.controller.abort();
      postMessageSafe({ type: "aborted", requestId: data.requestId, kind: entry.kind });
    }
    return;
  }

  if (data.type === "start") {
    void handleStart(data.requestId, data.input);
  }
});
