import type { AiLearningSpineDraft } from "./aiLearningSpineTypes";

export const buildTeacherRubricMiniSummary = (drafts: AiLearningSpineDraft[]) => {
  const total = drafts.length || 1;
  const verificationDone = drafts.filter((d) => Object.values(d.verificationState).some(Boolean)).length;
  const evidenceDone = drafts.filter((d) => d.evidence?.promptSummary || d.evidence?.changedReason).length;
  const publishScopeIssues = drafts.filter((d) => d.publishScope === "public_portfolio").length;
  return {
    mode: "dev-demo",
    promptChipUsageRate: Math.round((verificationDone / total) * 100),
    verificationCompletionRate: Math.round((verificationDone / total) * 100),
    evidenceCompletionRate: Math.round((evidenceDone / total) * 100),
    publicPortfolioNeedsGate: publishScopeIssues,
  };
};

export const buildAiLearningSpineTeacherSummary = (drafts: AiLearningSpineDraft[]) => {
  const safeTotal = drafts.length || 1;
  const withChipEngagement = drafts.filter((draft) => (draft.selectedChipIds?.length ?? 0) > 0).length;
  const withAnyVerification = drafts.filter((draft) => Object.values(draft.verificationState).some(Boolean)).length;
  const withEvidence = drafts.filter((draft) =>
    Boolean(draft.evidence?.promptSummary || draft.evidence?.changedReason || draft.evidence?.verificationNotes || draft.evidence?.nextRevision),
  ).length;
  const privacyGapCount = drafts.filter((draft) => !Object.entries(draft.verificationState).some(([key, value]) => key.includes("privacy") && Boolean(value))).length;
  const copyrightGapCount = drafts.filter((draft) => !Object.entries(draft.verificationState).some(([key, value]) => key.includes("copyright") && Boolean(value))).length;
  const accessibilityGapCount = drafts.filter((draft) => !Object.entries(draft.verificationState).some(([key, value]) => key.includes("accessibility") && Boolean(value))).length;
  return {
    mode: "dev-demo",
    totalDrafts: drafts.length,
    promptChipEngagementRate: Math.round((withChipEngagement / safeTotal) * 100),
    verificationCompletionRate: Math.round((withAnyVerification / safeTotal) * 100),
    evidenceCompletionRate: Math.round((withEvidence / safeTotal) * 100),
    privacyGapCount,
    copyrightGapCount,
    accessibilityGapCount,
    rubricReadiness: {
      educational_effectiveness: withEvidence,
      ethics_privacy: drafts.length - privacyGapCount,
      technical_reliability: withAnyVerification,
      accessibility_inclusion: drafts.length - accessibilityGapCount,
      personalized_support: withEvidence,
    },
  };
};
