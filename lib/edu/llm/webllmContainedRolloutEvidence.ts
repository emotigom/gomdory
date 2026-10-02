import type { WebllmContainedOperatorState } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";

export type WebllmContainedAttemptDecision =
  | "attempted_local"
  | "skipped_not_ready"
  | "skipped_out_of_scope"
  | "skipped_kill_switch"
  | "fallback_only";

export type WebllmContainedAttemptOutcome =
  | "success"
  | "timeout"
  | "engine_error"
  | "no_response"
  | "blocked"
  | "not_ready"
  | "fallback_only";

export type WebllmContainedAttemptEvidence = {
  attemptedAt: string;
  lessonIdSafe: string;
  operatorStateAtAttempt: WebllmContainedOperatorState;
  bootstrapReady: boolean;
  canonicalReady: boolean;
  healthReady: boolean;
  degradedBlocked: boolean;
  killSwitchOn: boolean;
  dispatchMode: string;
  attemptDecision: WebllmContainedAttemptDecision;
  outcome: WebllmContainedAttemptOutcome;
  safeReason: string;
  safeSummary: string;
};

const EVIDENCE_STORAGE_KEY = "edu:webllm:contained-rollout:evidence:v1";
const DEFAULT_EVIDENCE_LIMIT = 20;
const MEMORY_LIMIT = 200;
let memoryEvidence: WebllmContainedAttemptEvidence[] = [];

const clampEvidenceLimit = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_EVIDENCE_LIMIT;
  const rounded = Math.trunc(value as number);
  if (rounded <= 0) return DEFAULT_EVIDENCE_LIMIT;
  return Math.min(rounded, MEMORY_LIMIT);
};

const ensureIsoDate = (value: string | null | undefined): string => {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const sanitizeShortText = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ");
  if (!normalized) return fallback;
  return normalized.slice(0, 160);
};

const sanitizeLessonId = (lessonId: string | number | null | undefined): string => {
  if (typeof lessonId === "number" && Number.isFinite(lessonId)) {
    return String(Math.trunc(lessonId));
  }
  const normalized = typeof lessonId === "string" ? lessonId.trim() : "";
  if (!normalized) return "unknown";
  return normalized.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "unknown";
};

const trimEvidence = (records: WebllmContainedAttemptEvidence[], limit: number) =>
  records.slice(-limit);

const readStoredEvidence = (): WebllmContainedAttemptEvidence[] => {
  if (typeof window === "undefined") {
    return [...memoryEvidence];
  }
  try {
    const raw = window.localStorage.getItem(EVIDENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WebllmContainedAttemptEvidence => {
      if (!item || typeof item !== "object") return false;
      return (
        typeof item.attemptedAt === "string" &&
        typeof item.lessonIdSafe === "string" &&
        typeof item.operatorStateAtAttempt === "string" &&
        typeof item.dispatchMode === "string" &&
        typeof item.attemptDecision === "string" &&
        typeof item.outcome === "string" &&
        typeof item.safeReason === "string" &&
        typeof item.safeSummary === "string"
      );
    });
  } catch {
    return [];
  }
};

const persistEvidence = (records: WebllmContainedAttemptEvidence[]) => {
  const normalized = [...records];
  memoryEvidence = normalized;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // storage best-effort only
  }
};

export const buildWebllmContainedAttemptEvidence = (
  input: Omit<WebllmContainedAttemptEvidence, "attemptedAt" | "lessonIdSafe" | "safeReason" | "safeSummary"> & {
    attemptedAt?: string | null;
    lessonIdSafe: string | number | null | undefined;
    safeReason?: string | null;
    safeSummary?: string | null;
  },
): WebllmContainedAttemptEvidence => {
  const attemptedAt = ensureIsoDate(input.attemptedAt);
  const lessonIdSafe = sanitizeLessonId(input.lessonIdSafe);
  const safeReason = sanitizeShortText(input.safeReason ?? "none", "none");
  const safeSummary =
    sanitizeShortText(
      input.safeSummary ??
        `${input.operatorStateAtAttempt}: ${input.attemptDecision}/${input.outcome} (${safeReason})`,
      "no_summary",
    );

  return {
    attemptedAt,
    lessonIdSafe,
    operatorStateAtAttempt: input.operatorStateAtAttempt,
    bootstrapReady: input.bootstrapReady,
    canonicalReady: input.canonicalReady,
    healthReady: input.healthReady,
    degradedBlocked: input.degradedBlocked,
    killSwitchOn: input.killSwitchOn,
    dispatchMode: sanitizeShortText(input.dispatchMode, "unknown"),
    attemptDecision: input.attemptDecision,
    outcome: input.outcome,
    safeReason,
    safeSummary,
  };
};

export const getWebllmContainedRolloutEvidence = (limit?: number): WebllmContainedAttemptEvidence[] => {
  const safeLimit = clampEvidenceLimit(limit);
  return trimEvidence(readStoredEvidence(), safeLimit);
};

export const appendWebllmContainedRolloutEvidence = (
  evidence: WebllmContainedAttemptEvidence,
  limit?: number,
): WebllmContainedAttemptEvidence[] => {
  const safeLimit = clampEvidenceLimit(limit);
  const next = trimEvidence([...readStoredEvidence(), evidence], safeLimit);
  persistEvidence(next);
  return next;
};

export const __resetWebllmContainedRolloutEvidenceForTests = () => {
  memoryEvidence = [];
};
