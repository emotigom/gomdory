import "server-only";

export type LogWithContextInput = {
  level: "info" | "warn" | "error";
  stage: string;
  requestId: string;
  route?: string | null;
  status?: number | null;
  meta?: Record<string, unknown> | null;
};

export function logWithContext({ level, stage, requestId, route, status, meta }: LogWithContextInput) {
  const payload = {
    level,
    stage,
    requestId,
    route: route ?? undefined,
    status: status ?? undefined,
    meta: meta ?? undefined,
  };

  const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logFn(JSON.stringify(payload, (_key, value) => (value === undefined ? undefined : value)));
}
