export function buildPilotQaDemoData() {
  const now = new Date().toISOString();
  return {
    "gomdory.aiCourseware.localDrafts.v1": {
      3: {
        lessonNumber: 3,
        artifactType: "activity-card",
        artifactLabelKo: "활동 카드",
        titleKo: "에너지 절약 아이디어",
        bodyKo: "교실에서 실천 가능한 에너지 절약 3가지를 정리합니다.",
        updatedAt: now,
      },
    },
    "gomdory.aiCourseware.pageDrafts.v1": {
      3: {
        lessonNumber: 3,
        titleKo: "우리 반 에너지 절약 발표",
        blocks: [{ type: "heading", text: "에너지 절약 실천" }, { type: "paragraph", text: "교실에서 바로 실천할 수 있는 항목을 모았습니다." }],
        updatedAt: now,
      },
    },
    "gomdory.aiCourseware.safetyChecks.v1": {
      "presentation:lesson-3": { targetType: "presentation", targetId: "lesson-3", acknowledged: true, checkedAt: now, source: "local-safety-check", version: 1 },
    },
    "gomdory.aiCourseware.revisionEvidence.v1": [
      { evidenceId: "qa-evidence-1", lessonNumber: 3, targetType: "artifact-draft", aiDraftKo: "절약 방법을 써 보세요", studentRevisionKo: "실천 가능한 행동으로 구체화했어요", studentConfirmed: true, aiTask: "revise", generatedBy: "template", createdAt: now, updatedAt: now, source: "courseware-revision-evidence", version: 1 },
    ],
    "gomdory.aiCourseware.portfolio.v1": {
      portfolioId: "portfolio-qa-demo",
      titleKo: "파일럿 QA 포트폴리오",
      selectedArtifactRefs: [{ refId: "demo-3", lessonNumber: 3, artifactType: "activity-card", artifactLabelKo: "활동 카드", source: "manual" }],
      selectedPublishedLinks: [],
      selectedRevisionEvidenceIds: ["qa-evidence-1"],
      finalReflection: { aiHelpedKo: "초안을 참고", myDecisionKo: "핵심 문장 수정", nextImproveKo: "근거 추가", studentConfirmed: true },
      updatedAt: now,
      source: "local-portfolio",
      version: 1,
    },
    "gomdory.aiCourseware.teacherDashboard.v1": {
      selectedDayNumber: 2,
      collectedLinks: [{ shareId: "demoqa1", publicUrl: "/edu/courseware/p/demoqa1", displayLabel: "교사 매뉴얼 예시 링크", createdAt: now }],
      updatedAt: now,
      source: "local-teacher-dashboard",
      version: 1,
    },
  } as const;
}
