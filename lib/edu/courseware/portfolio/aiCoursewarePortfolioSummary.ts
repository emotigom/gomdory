import type { CoursewarePortfolio } from "./aiCoursewarePortfolioTypes";

export const isFinalReflectionComplete = (portfolio: CoursewarePortfolio) =>
  Boolean(portfolio.finalReflection.aiHelpedKo.trim() && portfolio.finalReflection.myDecisionKo.trim() && portfolio.finalReflection.nextImproveKo.trim() && portfolio.finalReflection.studentConfirmed);

export const buildShowcaseSummaryKo = (portfolio: CoursewarePortfolio, revisionEvidenceCount: number) => {
  const highlights = portfolio.selectedArtifactRefs.slice(0, 3).map((x) => `- ${x.artifactLabelKo}${x.titleKo ? `: ${x.titleKo}` : ""}`).join("\n");
  return [
    `문제 → 만든 것 → AI 활용 → 내가 고친 점 → 배운 점`,
    `제목: ${portfolio.titleKo}`,
    `하이라이트\n${highlights || "- 아직 하이라이트를 고르지 않았어요."}`,
    `수정 기록 수: ${revisionEvidenceCount}`,
  ].join("\n");
};

export const buildPortfolioExportJson = (portfolio: CoursewarePortfolio) => JSON.stringify({
  ...portfolio,
  selectedArtifactRefs: portfolio.selectedArtifactRefs.map((x) => ({ lessonNumber: x.lessonNumber, artifactType: x.artifactType, artifactLabelKo: x.artifactLabelKo, titleKo: x.titleKo, summaryKo: x.summaryKo, source: x.source })),
  selectedPublishedLinks: portfolio.selectedPublishedLinks.map((x) => ({ publicUrl: x.publicUrl, shareId: x.shareId, titleKo: x.titleKo, lessonNumber: x.lessonNumber, noteKo: x.noteKo })),
}, null, 2);
