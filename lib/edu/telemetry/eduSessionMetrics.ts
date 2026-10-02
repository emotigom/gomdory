export type EduMetricStep = "INPUT" | "COACH" | "GEN" | "APPLY";
export type EduLessonId = "P1" | "P2" | "P3" | "P4";
export type EduPanelStepId = "chat" | "ready" | "generate" | "complete";

export type EduMetricEventName =
  | "chatpanel_render_ok"
  | "chatpanel_render_error_boundary"
  | "generator_request_start"
  | "generator_request_success"
  | "generator_request_fail"
  | "template_select_count"
  | `step_enter_${EduPanelStepId}`
  | `step_complete_${EduPanelStepId}`;

export const EDU_FAILURE_KEYS = [
  "GEN_FAIL",
  "EB_FALLBACK",
  "NET_FAIL",
  "JSON_FAIL",
  "TEMPLATE_FAIL",
] as const;

export type EduFailureKey = (typeof EDU_FAILURE_KEYS)[number];

export type EduFailureMetricSummary = {
  key: EduFailureKey;
  count: number;
};

export type EduMetricCounters = Record<string, number>;

export type EduMetricEvent =
  | { t: number; type: "STEP"; step: EduMetricStep; ok: boolean; code?: string }
  | {
      t: number;
      type: "WARN";
      code: "KANA" | "META" | "MARKDOWN" | "OFFTRACK" | "SLOW" | "RETRY" | "FALLBACK";
      count?: number;
    }
  | {
      t: number;
      type: "HARDFAIL";
      code: "COACH_TIMEOUT" | "GEN_TIMEOUT" | "ENGINE_ERROR" | "SCHEMA_INVALID" | "RENDER_FAIL" | "MISSING_REFS";
    }
  | { t: number; type: "LESSON"; lessonId: EduLessonId; locked: boolean }
  | { t: number; type: "ACTION"; name: "ABORT" | "RESET_ENGINE" | "RESET_SESSION" | "EXPORT" }
  | { t: number; type: "EVENT"; name: EduMetricEventName; codeHash?: string };

export type EduMetricsSummary = {
  progressPct: number;
  doneCount: number;
  warnCount: number;
  hardFailCount: number;
  step: Record<EduMetricStep, { ok: number; fail: number }>;
  recentWarnCodes: string[];
  lessonId: EduLessonId;
  locked: boolean;
  metricCounters?: EduMetricCounters;
};

export type EduMetricEventType = EduMetricEvent["type"] | EduMetricEventName;

export type EduSafeEventMeta = {
  codeHash?: string;
  stepId?: EduPanelStepId;
  templateKey?: string;
};

export type EduMetricEventSnapshot = {
  ts: number;
  type: EduMetricEventType;
  meta?: EduSafeEventMeta;
};

export type EduMetricsExportSafe = {
  limit: number;
  total: number;
  summary: EduMetricsSummary;
  buildId: string | null;
  currentStepId: EduPanelStepId | null;
  templateKey: string | null;
  panelState: string | null;
  recentEvents: EduMetricEventSnapshot[];
};

export type EduMetricsExportContext = {
  buildId?: string | null;
  currentStepId?: EduPanelStepId | null;
  templateKey?: string | null;
  panelState?: string | null;
  recentEvents?: EduMetricEventSnapshot[];
};

const STEP_ORDER: EduMetricStep[] = ["INPUT", "COACH", "GEN", "APPLY"];
const STEP_INDEX = STEP_ORDER.reduce<Record<EduMetricStep, number>>((acc, step, index) => {
  acc[step] = index;
  return acc;
}, {} as Record<EduMetricStep, number>);

const createEmptyStepSummary = (): EduMetricsSummary["step"] => ({
  INPUT: { ok: 0, fail: 0 },
  COACH: { ok: 0, fail: 0 },
  GEN: { ok: 0, fail: 0 },
  APPLY: { ok: 0, fail: 0 },
});

const LESSON_IDS: EduLessonId[] = ["P1", "P2", "P3", "P4"];

const normalizeNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(value) ? Number(value) : fallback;

const hashCode = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
};

const buildEventSnapshot = (event: EduMetricEvent): EduMetricEventSnapshot => {
  if (event.type === "EVENT") {
    const meta: EduSafeEventMeta = {};
    if (event.codeHash) {
      meta.codeHash = event.codeHash;
    }
    const stepMatch = event.name.match(/^step_(?:enter|complete)_(.+)$/);
    if (stepMatch?.[1]) {
      meta.stepId = stepMatch[1] as EduPanelStepId;
    }
    return { ts: event.t, type: event.name, meta: Object.keys(meta).length ? meta : undefined };
  }
  if (event.type === "WARN") {
    return { ts: event.t, type: event.type, meta: { codeHash: hashCode(event.code) } };
  }
  if (event.type === "HARDFAIL") {
    return { ts: event.t, type: event.type, meta: { codeHash: hashCode(event.code) } };
  }
  if (event.type === "STEP") {
    return {
      ts: event.t,
      type: event.type,
      meta: { codeHash: hashCode(`${event.step}:${event.ok ? "ok" : "fail"}`) },
    };
  }
  if (event.type === "LESSON") {
    return {
      ts: event.t,
      type: event.type,
      meta: { codeHash: hashCode(`${event.lessonId}:${event.locked ? "locked" : "open"}`) },
    };
  }
  return {
    ts: event.t,
    type: event.type,
    meta: { codeHash: hashCode(event.name) },
  };
};

const normalizeStepBucket = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return { ok: 0, fail: 0 };
  }
  const bucket = value as { ok?: unknown; fail?: unknown };
  return {
    ok: normalizeNumber(bucket.ok),
    fail: normalizeNumber(bucket.fail),
  };
};

const normalizeMetricCounters = (value: unknown): EduMetricCounters => {
  if (!value || typeof value !== "object") {
    return {};
  }
  const counters: EduMetricCounters = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeNumber(count, 0);
    if (Number.isFinite(normalized)) {
      counters[key] = normalized;
    }
  }
  return counters;
};

export function normalizeMetricsSummary(value?: Partial<EduMetricsSummary> | null): EduMetricsSummary {
  const safeStep = value?.step && typeof value.step === "object" ? value.step : createEmptyStepSummary();
  const recentWarnCodes = Array.isArray(value?.recentWarnCodes)
    ? value!.recentWarnCodes.filter((code): code is string => typeof code === "string")
    : [];
  const lessonId = LESSON_IDS.includes(value?.lessonId as EduLessonId)
    ? (value!.lessonId as EduLessonId)
    : "P1";

  const progressPct = normalizeNumber(value?.progressPct);
  const clampedProgress = Math.min(100, Math.max(0, progressPct));

  return {
    progressPct: clampedProgress,
    doneCount: normalizeNumber(value?.doneCount),
    warnCount: normalizeNumber(value?.warnCount),
    hardFailCount: normalizeNumber(value?.hardFailCount),
    step: {
      INPUT: normalizeStepBucket(safeStep.INPUT),
      COACH: normalizeStepBucket(safeStep.COACH),
      GEN: normalizeStepBucket(safeStep.GEN),
      APPLY: normalizeStepBucket(safeStep.APPLY),
    },
    recentWarnCodes,
    lessonId,
    locked: Boolean(value?.locked),
    metricCounters: normalizeMetricCounters(value?.metricCounters),
  };
}

export function mapMetricNameToFailureKey(metricName: string): EduFailureKey | null {
  switch (metricName) {
    case "generator_request_fail":
      return "GEN_FAIL";
    case "chatpanel_render_error_boundary":
      return "EB_FALLBACK";
    case "network_request_fail":
    case "network_fetch_fail":
      return "NET_FAIL";
    case "content_json_parse_fail":
    case "content_format_json_fail":
      return "JSON_FAIL";
    case "template_select_fail":
    case "template_resolve_fail":
      return "TEMPLATE_FAIL";
    default:
      return null;
  }
}

export function getFailureTopK(
  summaryOrCounters: EduMetricsSummary | EduMetricCounters | Map<string, number> | null | undefined,
  k = 3,
): EduFailureMetricSummary[] {
  const counters =
    summaryOrCounters instanceof Map
      ? Object.fromEntries(summaryOrCounters.entries())
      : (summaryOrCounters as EduMetricsSummary | EduMetricCounters | null | undefined)?.metricCounters ??
        (summaryOrCounters as EduMetricCounters | null | undefined) ??
        {};

  const entries: EduFailureMetricSummary[] = [];

  for (const [metricName, countValue] of Object.entries(counters)) {
    const key = mapMetricNameToFailureKey(metricName);
    if (!key) continue;
    const count = normalizeNumber(countValue, 0);
    if (count <= 0) continue;
    entries.push({ key, count });
  }

  return entries.sort((a, b) => b.count - a.count).slice(0, Math.max(0, k));
}

export function createEduMetricsBuffer(limit = 200) {
  const events: EduMetricEvent[] = [];

  const add = (event: EduMetricEvent) => {
    events.push(event);
    if (events.length > limit) {
      events.splice(0, events.length - limit);
    }
  };

  const summary = (): EduMetricsSummary => {
    const step = createEmptyStepSummary();
    let warnCount = 0;
    let hardFailCount = 0;
    let lessonId: EduLessonId = "P1";
    let locked = false;
    let lastOkStepIndex = -1;
    const metricCounters: EduMetricCounters = {};
    const recentWarnCodes: string[] = [];

    for (const event of events) {
      switch (event.type) {
        case "STEP": {
          const stepBucket = step[event.step];
          if (event.ok) {
            stepBucket.ok += 1;
            lastOkStepIndex = Math.max(lastOkStepIndex, STEP_INDEX[event.step]);
          } else {
            stepBucket.fail += 1;
          }
          break;
        }
        case "WARN": {
          warnCount += event.count ?? 1;
          recentWarnCodes.push(event.code);
          if (recentWarnCodes.length > 3) {
            recentWarnCodes.shift();
          }
          break;
        }
        case "HARDFAIL": {
          hardFailCount += 1;
          break;
        }
        case "LESSON": {
          lessonId = event.lessonId;
          locked = event.locked;
          break;
        }
        case "ACTION": {
          break;
        }
        case "EVENT": {
          metricCounters[event.name] = (metricCounters[event.name] ?? 0) + 1;
          break;
        }
      }
    }

    const doneCount = step.APPLY.ok;
    const progressPct =
      lastOkStepIndex < 0 ? 0 : Math.round(((lastOkStepIndex + 1) / STEP_ORDER.length) * 100);

    return {
      progressPct,
      doneCount,
      warnCount,
      hardFailCount,
      step,
      recentWarnCodes,
      lessonId,
      locked,
      metricCounters,
    };
  };

  const exportSafe = (context: EduMetricsExportContext = {}): EduMetricsExportSafe => ({
    limit,
    total: events.length,
    summary: summary(),
    buildId: context.buildId ?? null,
    currentStepId: context.currentStepId ?? null,
    templateKey: context.templateKey ?? null,
    panelState: context.panelState ?? null,
    recentEvents: context.recentEvents ?? events.slice(-20).map((event) => buildEventSnapshot(event)),
  });

  const clear = () => {
    events.length = 0;
  };

  return {
    add,
    summary,
    exportSafe,
    clear,
  };
}
