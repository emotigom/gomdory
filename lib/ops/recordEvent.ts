import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OpsEventLevel = "info" | "warn" | "error";
export type OpsEventKind =
  | "api_error"
  | "api_access"
  | "api_slow"
  | "api_redirect_loop"
  | "edu_cleanup"
  | "edu_project_report"
  | "edu_project_hide_toggle"
  | "not_found"
  | "not_found_spike"
  | "ui_error"
  | "ui_slow"
  | "smoke"
  | "auth"
  | "storage"
  | "deploy";

export const OPS_EVENT_KIND = {
  apiAccess: "api_access",
  apiError: "api_error",
} as const;

export const OPS_EVENT_FIELDS = {
  requestId: "request_id",
} as const;

export type OpsEventInput = {
  level: OpsEventLevel;
  kind: OpsEventKind;
  requestId?: string | null;
  request_id?: string | null;
  route?: string | null;
  status?: number | null;
  durationMs?: number | null;
  duration_ms?: number | null;
  meta?: Record<string, unknown> | null;
};

type RecordOpsEventOptions = {
  sampleRate?: number;
  hardLimitPerMinute?: number;
};

const DEFAULT_SAMPLE_RATE = 10;
const DEFAULT_HARD_LIMIT = 30;
const MAX_META_LENGTH = 10_000;
const perMinuteCounters = new Map<string, { minute: number; count: number }>();

function sanitizeMeta(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return null;

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    if (typeof value === "string" && /token|returnto|authorization/i.test(key)) {
      cleaned[key] = "[redacted]";
      continue;
    }

    cleaned[key] = value;
  }

  const serialized = JSON.stringify(cleaned);
  if (serialized.length > MAX_META_LENGTH) {
    return { note: "meta_truncated", preview: serialized.slice(0, 1024) };
  }

  return cleaned;
}

function shouldSample(sampleRate: number) {
  if (sampleRate <= 1) return true;
  return Math.floor(Math.random() * sampleRate) === 0;
}

function underHardLimit(kind: string, hardLimit: number, now = Date.now()) {
  const minute = Math.floor(now / 60000);
  const current = perMinuteCounters.get(kind);
  if (!current || current.minute !== minute) {
    perMinuteCounters.set(kind, { minute, count: 1 });
    return true;
  }

  if (current.count >= hardLimit) {
    return false;
  }

  current.count += 1;
  return true;
}

export async function recordOpsEvent(
  event: OpsEventInput,
  options: RecordOpsEventOptions = {},
) {
  const sampleRate = Number.isFinite(options.sampleRate)
    ? Math.max(1, Math.floor(options.sampleRate!))
    : DEFAULT_SAMPLE_RATE;
  const hardLimitPerMinute = Number.isFinite(options.hardLimitPerMinute)
    ? Math.max(1, Math.floor(options.hardLimitPerMinute!))
    : DEFAULT_HARD_LIMIT;

  if (!shouldSample(sampleRate)) {
    return { sampled: false, recorded: false };
  }

  if (!underHardLimit(event.kind, hardLimitPerMinute)) {
    return { sampled: true, recorded: false };
  }

  try {
    const client = createSupabaseAdminClient();
    const { error } = await client.from("ops_events").insert({
      level: event.level,
      kind: event.kind,
      request_id: event.requestId ?? event.request_id ?? null,
      ts: new Date().toISOString(),
      route: event.route ?? null,
      status: event.status ?? null,
      duration_ms: event.durationMs ?? event.duration_ms ?? null,
      meta: sanitizeMeta(event.meta),
      sample_rate: sampleRate,
    });

    if (error) {
      console.warn("[ops] failed to insert ops_event", { message: error.message });
      return { sampled: true, recorded: false };
    }

    return { sampled: true, recorded: true };
  } catch (error) {
    console.warn("[ops] ops_event logging skipped", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { sampled: true, recorded: false };
  }
}
