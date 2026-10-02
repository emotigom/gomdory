export type SingleFlightTask<T> = {
  run: (fn: (signal: AbortSignal) => Promise<T>, options?: SingleFlightRunOptions) => Promise<T>;
  abort: (reason?: unknown) => void;
  isRunning: () => boolean;
  queue: (fn: (signal: AbortSignal) => Promise<T>, options?: SingleFlightRunOptions) => void;
};

type SingleFlightMode = "replace" | "queue1";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export type SingleFlightRunOptions = {
  timeoutMs?: number;
  onTimeout?: (context: { timeoutMs: number; startedAt: number }) => unknown;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
};

const createAbortError = () => {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }
  const error = new Error("Aborted");
  (error as Error & { name: string }).name = "AbortError";
  return error;
};

const normalizeTimeoutMs = (timeoutMs: number | undefined) => {
  const candidate = Number(timeoutMs);
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.round(candidate);
};

export const createSingleFlight = <T,>({ mode }: { mode: SingleFlightMode }): SingleFlightTask<T> => {
  let running = false;
  let controller: AbortController | null = null;
  let currentToken = 0;
  let currentTimeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let nextFn: ((signal: AbortSignal) => Promise<T>) | null = null;
  let nextDeferred: Deferred<T> | null = null;
  let nextOptions: SingleFlightRunOptions | undefined;

  const clearCurrentTimeout = () => {
    if (currentTimeoutId !== null) {
      globalThis.clearTimeout(currentTimeoutId);
      currentTimeoutId = null;
    }
  };

  const start = (fn: (signal: AbortSignal) => Promise<T>, deferred?: Deferred<T>, options?: SingleFlightRunOptions) => {
    const token = (currentToken += 1);
    clearCurrentTimeout();
    const localController = new AbortController();
    controller = localController;
    running = true;
    const startedAt = Date.now();
    const timeoutMs = normalizeTimeoutMs(options?.timeoutMs);

    if (timeoutMs > 0) {
      currentTimeoutId = globalThis.setTimeout(() => {
        if (currentToken !== token) return;
        const timeoutReason = options?.onTimeout?.({ timeoutMs, startedAt }) ?? { reason: "timeout", timeoutMs, startedAt };
        localController.abort(timeoutReason);
      }, timeoutMs);
    }

    const runPromise = Promise.resolve().then(() => fn(localController.signal));

    const finalize = (shouldSchedule: boolean, resultPromise: Promise<T>) => {
      void resultPromise.finally(() => {
        if (currentToken !== token) {
          return;
        }
        clearCurrentTimeout();
        running = false;
        controller = null;
        if (mode === "queue1" && shouldSchedule && nextFn) {
          const queued = nextFn;
          const queuedDeferred = nextDeferred;
          const queuedOptions = nextOptions;
          nextFn = null;
          nextDeferred = null;
          nextOptions = undefined;
          start(queued, queuedDeferred ?? undefined, queuedOptions);
        }
      });
    };

    const result = runPromise;
    if (deferred) {
      result.then(deferred.resolve).catch(deferred.reject);
    }
    finalize(true, result);
    return result;
  };

  const abort = (reason?: unknown) => {
    clearCurrentTimeout();
    if (controller) {
      if (reason === undefined) {
        controller.abort();
      } else {
        controller.abort(reason);
      }
    }
    controller = null;
    running = false;
    if (nextDeferred) {
      nextDeferred.reject(createAbortError());
      nextDeferred = null;
    }
    nextFn = null;
    nextOptions = undefined;
  };

  const run = (fn: (signal: AbortSignal) => Promise<T>, options?: SingleFlightRunOptions) => {
    if (mode === "replace") {
      clearCurrentTimeout();
      controller?.abort();
      return start(fn, undefined, options);
    }

    if (running) {
      if (nextDeferred) {
        nextDeferred.reject(createAbortError());
      }
      const deferred = createDeferred<T>();
      nextFn = fn;
      nextDeferred = deferred;
      nextOptions = options;
      return deferred.promise;
    }

    return start(fn, undefined, options);
  };

  const queue = (fn: (signal: AbortSignal) => Promise<T>, options?: SingleFlightRunOptions) => {
    if (mode === "queue1") {
      if (running) {
        if (nextDeferred) {
          nextDeferred.reject(createAbortError());
        }
        nextFn = fn;
        nextDeferred = createDeferred<T>();
        nextOptions = options;
        return;
      }
    }
    void run(fn, options);
  };

  return {
    run,
    abort,
    isRunning: () => running,
    queue,
  };
};
