import type {
  WebLLMWorkerInput,
  WebLLMWorkerProgressEvent,
  WebLLMWorkerRequest,
  WebLLMWorkerResponse,
} from "./webllmWorkerTypes";

type ProgressListener = (event: WebLLMWorkerProgressEvent) => void;

let worker: Worker | null = null;
const listeners = new Set<ProgressListener>();
const pendingRequests = new Map<
  string,
  {
    resolve: (value: WebLLMWorkerResponse) => void;
    reject: (error: Error) => void;
  }
>();
let lastProgressEvent: WebLLMWorkerProgressEvent | null = null;
let activeRequestCount = 0;
let longTaskObserver: PerformanceObserver | null = null;
let lastLongTaskLogAt = 0;

const LONGTASK_LOG_COOLDOWN_MS = 5000;

const ensureLongTaskObserver = () => {
  if (longTaskObserver) return;
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;
  if (typeof PerformanceObserver === "undefined") return;
  if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;

  longTaskObserver = new PerformanceObserver((list) => {
    if (activeRequestCount <= 0) return;
    const now = Date.now();
    if (now - lastLongTaskLogAt < LONGTASK_LOG_COOLDOWN_MS) return;
    const entries = list.getEntries();
    const entry = entries[entries.length - 1];
    lastLongTaskLogAt = now;
    console.warn("[edu] webllm.longtask", {
      durationMs: Math.round(entry?.duration ?? 0),
      requestCount: activeRequestCount,
    });
  });
  longTaskObserver.observe({ entryTypes: ["longtask"] });
};

const ensureWorker = () => {
  if (worker) return worker;
  if (typeof window === "undefined") {
    throw new Error("WebLLM worker는 브라우저 환경에서만 실행됩니다.");
  }
  worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event) => {
    const data = event.data as WebLLMWorkerResponse;
    if (data?.type === "progress") {
      lastProgressEvent = data;
      listeners.forEach((listener) => listener(data));
      return;
    }
    if (!data || typeof data !== "object" || !("requestId" in data)) {
      return;
    }
    const entry = pendingRequests.get(data.requestId);
    if (entry) {
      entry.resolve(data);
      pendingRequests.delete(data.requestId);
    }
  });
  worker.addEventListener("error", (event) => {
    const error = event instanceof ErrorEvent ? event.error ?? new Error(event.message) : undefined;
    pendingRequests.forEach((entry) => entry.reject(error ?? new Error("워커 오류가 발생했습니다.")));
    pendingRequests.clear();
    activeRequestCount = 0;
  });
  return worker;
};

export const start = (requestId: string, input: WebLLMWorkerInput) => {
  const activeWorker = ensureWorker();
  ensureLongTaskObserver();
  activeRequestCount += 1;
  return new Promise<WebLLMWorkerResponse>((resolve, reject) => {
    const finalize = () => {
      activeRequestCount = Math.max(0, activeRequestCount - 1);
    };
    pendingRequests.set(requestId, {
      resolve: (value) => {
        finalize();
        resolve(value);
      },
      reject: (error) => {
        finalize();
        reject(error);
      },
    });
    activeWorker.postMessage({ type: "start", requestId, input } satisfies WebLLMWorkerRequest);
  });
};

export const onProgress = (listener: ProgressListener) => {
  listeners.add(listener);
  if (lastProgressEvent) {
    listener(lastProgressEvent);
  }
  return () => listeners.delete(listener);
};

export const abort = (requestId: string) => {
  const activeWorker = ensureWorker();
  activeWorker.postMessage({ type: "abort", requestId } satisfies WebLLMWorkerRequest);
};

export const terminate = () => {
  if (!worker) return;
  const activeWorker = worker;
  const requestIds = Array.from(pendingRequests.keys());
  requestIds.forEach((requestId) => {
    activeWorker.postMessage({ type: "abort", requestId } satisfies WebLLMWorkerRequest);
  });
  globalThis.setTimeout(() => {
    if (worker !== activeWorker) return;
    try {
      activeWorker.terminate();
    } catch {
      // ignore worker termination failures
    }
    worker = null;
    const error = new Error("WebLLM worker terminated");
    pendingRequests.forEach((entry) => entry.reject(error));
    pendingRequests.clear();
    activeRequestCount = 0;
  }, 120);
};
