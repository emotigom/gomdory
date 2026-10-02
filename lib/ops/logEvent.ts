export type LogEventInput = {
  level: "info" | "warn" | "error";
  stage: string;
  requestId: string;
  route: string;
  action: string;
  ok: boolean;
  code?: string;
  reason?: string;
  meta?: Record<string, unknown>;
};

function sanitizeMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function logEvent(event: LogEventInput) {
  const payload = {
    ts: new Date().toISOString(),
    level: event.level,
    stage: event.stage,
    requestId: event.requestId,
    route: event.route,
    action: event.action,
    ok: event.ok,
    code: event.code,
    reason: event.reason,
    meta: sanitizeMeta(event.meta),
  };

  console.log(JSON.stringify(payload));
}
