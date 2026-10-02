type LogEventInput = {
  level: "info" | "warn" | "error";
  route: string;
  stage: string;
  requestId: string;
  latencyMs: number;
  code?: string | number;
};

type RequestCounters = {
  requestId: string;
  total: number;
  errors: number;
  stages: Record<string, number>;
  codes: Record<string, number>;
  lastSeenAt: number;
};

export type ErrorSummary = {
  at: string;
  level: "error";
  route: string;
  stage: string;
  requestId: string;
  latencyMs: number;
  code?: string | number;
};

type MeasureInput = {
  route: string;
  stage: string;
  requestId: string;
  code?: string | number;
  level?: "info" | "warn" | "error";
};

const MAX_REQUESTS = 200;
const MAX_ERROR_SUMMARIES = 25;

const requestCounters = new Map<string, RequestCounters>();
const errorSummaries: ErrorSummary[] = [];

function pruneRequestCounters() {
  if (requestCounters.size <= MAX_REQUESTS) return;
  const entries = Array.from(requestCounters.values()).sort((a, b) => a.lastSeenAt - b.lastSeenAt);
  const removeCount = requestCounters.size - MAX_REQUESTS;
  for (let index = 0; index < removeCount; index += 1) {
    requestCounters.delete(entries[index].requestId);
  }
}

function bumpRequestCounters(event: LogEventInput) {
  const now = Date.now();
  const existing = requestCounters.get(event.requestId);
  const counters: RequestCounters =
    existing ??
    ({
      requestId: event.requestId,
      total: 0,
      errors: 0,
      stages: {},
      codes: {},
      lastSeenAt: now,
    } satisfies RequestCounters);

  counters.total += 1;
  if (event.level === "error") counters.errors += 1;
  counters.stages[event.stage] = (counters.stages[event.stage] ?? 0) + 1;
  if (event.code !== undefined) {
    const codeKey = String(event.code);
    counters.codes[codeKey] = (counters.codes[codeKey] ?? 0) + 1;
  }
  counters.lastSeenAt = now;
  requestCounters.set(event.requestId, counters);
  pruneRequestCounters();
}

function recordErrorSummary(event: LogEventInput) {
  if (event.level !== "error") return;
  const summary: ErrorSummary = {
    at: new Date().toISOString(),
    level: "error",
    route: event.route,
    stage: event.stage,
    requestId: event.requestId,
    latencyMs: event.latencyMs,
    code: event.code,
  };
  errorSummaries.push(summary);
  if (errorSummaries.length > MAX_ERROR_SUMMARIES) {
    errorSummaries.splice(0, errorSummaries.length - MAX_ERROR_SUMMARIES);
  }
}

export function logEvent(event: LogEventInput) {
  const payload = {
    level: event.level,
    route: event.route,
    stage: event.stage,
    requestId: event.requestId,
    latencyMs: event.latencyMs,
    code: event.code,
  };

  console.log(JSON.stringify(payload));
  bumpRequestCounters(event);
  recordErrorSummary(event);
}

export async function measure<T>(input: MeasureInput, fn: () => Promise<T> | T): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logEvent({
      level: input.level ?? "info",
      route: input.route,
      stage: input.stage,
      requestId: input.requestId,
      latencyMs: Math.max(0, Date.now() - startedAt),
      code: input.code,
    });
    return result;
  } catch (error) {
    logEvent({
      level: "error",
      route: input.route,
      stage: input.stage,
      requestId: input.requestId,
      latencyMs: Math.max(0, Date.now() - startedAt),
      code: input.code ?? "exception",
    });
    throw error;
  }
}

export function getLastErrorSummary(): ErrorSummary | null {
  if (!errorSummaries.length) return null;
  return errorSummaries[errorSummaries.length - 1];
}
