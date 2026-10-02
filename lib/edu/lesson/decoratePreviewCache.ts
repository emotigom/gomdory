import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";

export type DecoratePreviewCacheEntry = {
  key: string;
  requestId: string;
  promptHash: string;
  primaryIntent: DecorateIntentSummary["primaryIntent"];
  confidence: number;
  ambiguous: boolean;
  previewHtml: string;
  previewHtmlHash: string;
  qualityScore: number;
  lowImpactPreview: boolean;
  enriched: boolean;
  source: "server_llm" | "local_llm" | "deterministic";
  fallbackReason: string | null;
  mutationCount: number;
  changedFiles: number;
  baseSnapshotVersion: string | null;
  baseHtmlHash: string;
  createdAt: number;
  expiresAt: number;
};

export type DecoratePreviewCacheInvalidateReason =
  | "user_edit"
  | "newer_decorate_apply"
  | "snapshot_changed"
  | "ttl_expired"
  | "stale_risk";

const normalizePrompt = (prompt: string) => prompt.trim().replace(/\s+/g, " ").toLowerCase();

export const hashDecoratePrompt = (prompt: string) => {
  const normalized = normalizePrompt(prompt);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const buildDecorateCacheKey = (input: {
  prompt: string;
  baseSnapshotVersion: string | null;
  baseHtmlHash: string;
  intent: Pick<DecorateIntentSummary, "primaryIntent" | "isAmbiguous">;
}) => {
  const normalizedPrompt = normalizePrompt(input.prompt);
  return [normalizedPrompt, input.baseSnapshotVersion ?? "none", input.baseHtmlHash, input.intent.primaryIntent, input.intent.isAmbiguous ? "amb" : "clear"].join("::");
};

export const shouldCacheDecoratePreview = (input: {
  satisfactionProxy?: "positive" | "neutral" | "negative";
  undoneAfterApply?: boolean;
  abandonedPreview?: boolean;
  staleInvalidated?: boolean;

  qualityScore: number;
  lowImpactPreview: boolean;
  enriched: boolean;
  invalidated: boolean;
  ambiguous: boolean;
  outcomeScore?: number;
  outcomeBucket?: "excellent" | "good" | "acceptable" | "weak" | "failed";
  planRecommendedAction?: "accept" | "accept_and_enrich" | "fallback" | "reject";
  staleRisk?: "low" | "medium" | "high";
}) => {
  if (input.invalidated) return { ok: false, reason: "invalidated_preview" };
  if (input.staleInvalidated) return { ok: false, reason: "stale_invalidated" };
  if (input.undoneAfterApply) return { ok: false, reason: "undone_after_apply" };
  if (input.abandonedPreview && input.satisfactionProxy === "negative") return { ok: false, reason: "abandoned_preview" };
  if (input.planRecommendedAction === "reject") return { ok: false, reason: "plan_rejected" };
  if (input.qualityScore < 0.35) return { ok: false, reason: "quality_too_low" };
  if (typeof input.outcomeScore === "number" && input.outcomeScore < 45) return { ok: false, reason: "outcome_score_too_low" };
  if (input.outcomeBucket === "failed" || input.outcomeBucket === "weak") return { ok: false, reason: "outcome_bucket_low" };
  if (input.staleRisk === "high") return { ok: false, reason: "stale_risk_high" };
  if (input.lowImpactPreview && !input.enriched) return { ok: false, reason: "low_impact_without_enrich" };
  return { ok: true, reason: input.ambiguous ? "store_with_short_ttl" : "store" };
};

export const getDecorateCacheTtlMs = (input: { ambiguous: boolean; satisfactionProxy?: "positive" | "neutral" | "negative" }) => {
  const base = input.ambiguous ? 15_000 : 90_000;
  if (input.satisfactionProxy === "positive") return Math.round(base * 1.2);
  if (input.satisfactionProxy === "negative") return Math.round(base * 0.35);
  return base;
};

export const createDecoratePreviewCache = (now: () => number = () => Date.now()) => {
  const entries = new Map<string, DecoratePreviewCacheEntry>();

  const purgeExpired = () => {
    const current = now();
    for (const [key, entry] of entries.entries()) {
      if (entry.expiresAt <= current) {
        entries.delete(key);
      }
    }
  };

  return {
    get(key: string) {
      purgeExpired();
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry;
    },
    set(entry: Omit<DecoratePreviewCacheEntry, "expiresAt"> & { ttlMs: number }) {
      entries.set(entry.key, { ...entry, expiresAt: now() + Math.max(1, entry.ttlMs) });
    },
    invalidateByBase(baseHtmlHash: string, reason: DecoratePreviewCacheInvalidateReason) {
      const invalidated: string[] = [];
      for (const [key, entry] of entries.entries()) {
        if (entry.baseHtmlHash === baseHtmlHash) {
          entries.delete(key);
          invalidated.push(key);
        }
      }
      return { reason, invalidated };
    },
    clear(reason: DecoratePreviewCacheInvalidateReason) {
      const count = entries.size;
      entries.clear();
      return { reason, count };
    },
    size() {
      purgeExpired();
      return entries.size;
    },
  };
};

export type DecoratePreviewCache = ReturnType<typeof createDecoratePreviewCache>;
