import type { LessonId } from "./types";
import { getLessonById } from "./lessons";

export type CodingStudioCurriculumStage = {
  stageId: "orientation" | "control" | "adaptation" | "readiness";
  label: string;
  focusArea: string;
  preparesNext: string;
  lessonIds: LessonId[];
};

export const CODING_STUDIO_CURRICULUM_MAP: CodingStudioCurriculumStage[] = [
  {
    stageId: "orientation",
    label: "입문 기초 · 위치와 방향",
    focusArea: "목표 도달을 위한 이동·회전 기준 형성",
    preparesNext: "반복 구조로 경로를 압축할 준비",
    lessonIds: ["goal-move", "turn-pivot"],
  },
  {
    stageId: "control",
    label: "입문 확장 · 구조화",
    focusArea: "반복 블록으로 경로를 간결하고 안정적으로 구성",
    preparesNext: "장면 반응형 분기 전략으로 전환",
    lessonIds: ["repeat-route"],
  },
  {
    stageId: "adaptation",
    label: "입문 확장 · 상황 대응",
    focusArea: "감지·분기·조정을 통해 재현 가능한 성공 루프 구축",
    preparesNext: "다중 조건 장면을 다루는 중급 코스로 연결",
    lessonIds: ["sensor-branch", "strategy-tune"],
  },
  {
    stageId: "readiness",
    label: "다음 단계 준비",
    focusArea: "회고 언어화와 다음 코스 진입 질문 정리",
    preparesNext: "복합 장면에서 우선순위 전략 설계",
    lessonIds: ["next-preview"],
  },
];

export function resolveCurriculumStageByLessonId(lessonId: LessonId) {
  return CODING_STUDIO_CURRICULUM_MAP.find((stage) => stage.lessonIds.includes(lessonId)) ?? CODING_STUDIO_CURRICULUM_MAP[0];
}

export function getCurriculumContinuityByLesson(lessonId: LessonId) {
  const lesson = getLessonById(lessonId);
  const stage = resolveCurriculumStageByLessonId(lessonId);
  return {
    lessonId,
    stageLabel: stage.label,
    rubricTarget: lesson.assessmentFocus,
    revisionFocus: lesson.retryHint,
    nextBridge: lesson.nextLessonPrompt,
  };
}

export function resolveCurriculumContinuityLine(lessonId: LessonId) {
  const continuity = getCurriculumContinuityByLesson(lessonId);
  return `${continuity.stageLabel} · ${continuity.rubricTarget} · ${continuity.nextBridge}`;
}
