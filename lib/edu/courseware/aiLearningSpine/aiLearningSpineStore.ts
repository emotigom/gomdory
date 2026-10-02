import { AI_SPINE_STORAGE_KEY, DEFAULT_PUBLISH_SCOPE, type AiLearningSpineDraft } from "./aiLearningSpineTypes";

type SpineStore = { v: 1; drafts: Record<number, AiLearningSpineDraft> };
const initialStore = (): SpineStore => ({ v: 1, drafts: {} });
const toBooleanRecord = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, checked]) => typeof checked === "boolean")
    .map(([key, checked]) => [key, checked as boolean]);
  return Object.fromEntries(entries);
};

const sanitizeDraft = (lessonNumber: number, raw: unknown): AiLearningSpineDraft => {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const publishScope = input.publishScope === "school_share" || input.publishScope === "public_portfolio"
    ? input.publishScope
    : DEFAULT_PUBLISH_SCOPE;
  const evidenceInput = input.evidence && typeof input.evidence === "object" ? (input.evidence as Record<string, unknown>) : null;
  return {
    lessonNumber,
    publishScope,
    verificationState: toBooleanRecord(input.verificationState),
    selectedChipIds: Array.isArray(input.selectedChipIds) ? input.selectedChipIds.filter((id): id is string => typeof id === "string") : [],
    evidence: evidenceInput
      ? {
          redactedPrompt: typeof evidenceInput.redactedPrompt === "string" ? evidenceInput.redactedPrompt : undefined,
          promptSummary: typeof evidenceInput.promptSummary === "string" ? evidenceInput.promptSummary : undefined,
          changedReason: typeof evidenceInput.changedReason === "string" ? evidenceInput.changedReason : undefined,
          verificationNotes: typeof evidenceInput.verificationNotes === "string" ? evidenceInput.verificationNotes : undefined,
          nextRevision: typeof evidenceInput.nextRevision === "string" ? evidenceInput.nextRevision : undefined,
        }
      : undefined,
  };
};

const readStore = (): SpineStore => {
  if (typeof window === "undefined") return initialStore();
  try {
    const raw = window.localStorage.getItem(AI_SPINE_STORAGE_KEY);
    if (!raw) return initialStore();
    const parsed = JSON.parse(raw) as Partial<SpineStore>;
    if (parsed.v !== 1 || !parsed.drafts || typeof parsed.drafts !== "object") return initialStore();
    const normalizedDrafts = Object.fromEntries(
      Object.entries(parsed.drafts).map(([lessonNumber, draft]) => [
        Number(lessonNumber),
        sanitizeDraft(Number(lessonNumber), draft),
      ]),
    ) as Record<number, AiLearningSpineDraft>;
    return { v: 1, drafts: normalizedDrafts };
  } catch {
    return initialStore();
  }
};

export const getAiLearningSpineDraft = (lessonNumber: number): AiLearningSpineDraft => {
  const store = readStore();
  return store.drafts[lessonNumber] ?? { lessonNumber, publishScope: DEFAULT_PUBLISH_SCOPE, verificationState: {} };
};

export const saveAiLearningSpineDraft = (draft: AiLearningSpineDraft) => {
  if (typeof window === "undefined") return;
  const store = readStore();
  store.drafts[draft.lessonNumber] = sanitizeDraft(draft.lessonNumber, draft);
  window.localStorage.setItem(AI_SPINE_STORAGE_KEY, JSON.stringify(store));
};
