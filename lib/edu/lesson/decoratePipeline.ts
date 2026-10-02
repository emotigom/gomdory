import { resolveSlotsFromHtmlV2 } from "@/lib/edu/lesson/slotResolverV2";

export const DECORATE_STAGES = ["engine_warmup", "slot_resolve", "generate_json", "parse_validate", "apply_patch"] as const;
export type DecorateStage = (typeof DECORATE_STAGES)[number];

export type DecorateGuardrailReason = "slot_not_found" | "slot_ambiguous" | "json_unrecoverable" | "policy_blocked" | "slot_not_selected";

export type DecorateMetrics = {
  requestId: string;
  startedAt: number;
  stageStartedAt: number;
  stage: DecorateStage;
  stageDurations: Partial<Record<DecorateStage, number>>;
  retryCount: number;
  parseFailCount: number;
  schemaFailCount: number;
  applyFailCount: number;
  slotCandidatesCount: number;
  selectedSlotId: string | null;
  selectedSelector: string | null;
  slotResolveSource: string | null;
  snapshotVersion: string | null;
  htmlHashBefore: string | null;
  htmlHashAfterInjection: string | null;
  committedHtmlHash: string | null;
  previewHtmlHash: string | null;
  previewMatchesCommitted: boolean | null;
  commitTargetKey: string | null;
  previewRefreshTriggered: boolean | null;
  guardrailReason: DecorateGuardrailReason | null;
  modelId: string | null;
  timeoutMs: number | null;
};

export const createDecorateMetrics = (input: { requestId: string; timeoutMs?: number | null; modelId?: string | null; now?: number }): DecorateMetrics => {
  const now = input.now ?? Date.now();
  return {
    requestId: input.requestId,
    startedAt: now,
    stageStartedAt: now,
    stage: "engine_warmup",
    stageDurations: {},
    retryCount: 0,
    parseFailCount: 0,
    schemaFailCount: 0,
    applyFailCount: 0,
    slotCandidatesCount: 0,
    selectedSlotId: null,
    selectedSelector: null,
    slotResolveSource: null,
    snapshotVersion: null,
    htmlHashBefore: null,
    htmlHashAfterInjection: null,
    committedHtmlHash: null,
    previewHtmlHash: null,
    previewMatchesCommitted: null,
    commitTargetKey: null,
    previewRefreshTriggered: null,
    guardrailReason: null,
    modelId: input.modelId ?? null,
    timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : null,
  };
};

export const startStage = (ctx: DecorateMetrics, stage: DecorateStage, now = Date.now()) => {
  ctx.stage = stage;
  ctx.stageStartedAt = now;
};
export const endStage = (ctx: DecorateMetrics, stage: DecorateStage, now = Date.now()) => {
  const elapsed = Math.max(0, now - ctx.stageStartedAt);
  ctx.stageDurations[stage] = elapsed;
  return elapsed;
};
export const incMetric = (ctx: DecorateMetrics, key: "retryCount" | "parseFailCount" | "schemaFailCount" | "applyFailCount", by = 1) => {
  ctx[key] += by;
  return ctx[key];
};
export const setMetric = <K extends keyof DecorateMetrics>(ctx: DecorateMetrics, key: K, value: DecorateMetrics[K]) => {
  ctx[key] = value;
};

export const resolvePhotoSlotCandidates = (html: string) =>
  resolveSlotsFromHtmlV2(html).candidates.filter((slot) => slot.type === "image").map((slot) => slot.id);

export const resolveSlotsFromHtml = (html: string) => {
  const resolved = resolveSlotsFromHtmlV2(html);
  return {
    candidates: resolved.candidates.map((slot) => ({ id: slot.id })),
    selectedSlotId: resolved.selected?.id,
  };
};

export const shouldBlockDecorateGenerateJson = (resolved: { candidates: { id: string }[]; selectedSlotId?: string }) =>
  resolved.candidates.length === 0 || !resolved.selectedSlotId;

export const requestLooksLikePhotoEdit = (request: string) => /(?:img|image|photo|picture|사진|그림)/i.test(request);
export const hasDisallowedImageSource = (html: string) => /<img[^>]+src\s*=\s*["']https?:\/\//i.test(html);
