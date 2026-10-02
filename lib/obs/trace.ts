export type TraceTimings = {
  t_start: number;
  t_db?: number;
  t_r2?: number;
  t_total?: number;
};

export type TraceState = {
  requestId: string;
  timings: TraceTimings;
  markDb: () => void;
  markR2: () => void;
  finalize: () => TraceTimings;
};

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function startTrace(requestId = crypto.randomUUID()): TraceState {
  const timings: TraceTimings = { t_start: nowMs() };

  const markDb = () => {
    timings.t_db = nowMs() - timings.t_start;
  };

  const markR2 = () => {
    timings.t_r2 = nowMs() - timings.t_start;
  };

  const finalize = () => {
    timings.t_total = nowMs() - timings.t_start;
    return timings;
  };

  return { requestId, timings, markDb, markR2, finalize };
}

export function buildServerTiming(timings: TraceTimings): string | null {
  const parts: string[] = [];

  if (typeof timings.t_db === "number") {
    parts.push(`db;dur=${timings.t_db.toFixed(1)}`);
  }

  if (typeof timings.t_r2 === "number") {
    parts.push(`r2;dur=${timings.t_r2.toFixed(1)}`);
  }

  if (typeof timings.t_total === "number") {
    parts.push(`total;dur=${timings.t_total.toFixed(1)}`);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function attachTraceHeaders(response: Response, state: TraceState): Response {
  const timings = state.finalize();
  const serverTiming = buildServerTiming(timings);

  const headers = new Headers(response.headers);
  headers.set("x-request-id", state.requestId);
  headers.set("x-gomdory-request-id", state.requestId);

  if (serverTiming) {
    headers.set("server-timing", serverTiming);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
