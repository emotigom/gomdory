import { getLessonById } from "./lessons";
import { CODING_STUDIO_RUBRIC_SCHEMA } from "./rubricSchema";
import type { LessonId } from "./types";

type LegacyLessonId = "loop-turn" | "sensor-avoid";

type LearningGoalSummaryInput =
  | LessonId
  | LegacyLessonId
  | {
      lessonId: LessonId | LegacyLessonId;
      completedCount?: number;
      feedbackCount?: number;
    };

export type CodingStudioLearningGoalSummary = {
  title: string;
  whyThisMatters: string;
  momentumLine: string;
  progressLine: string;
  currentPractice: string;
  refineFocus: string;
  nextBridge: string;
};

function resolveSummaryInput(input: LearningGoalSummaryInput): {
  lessonId: LessonId;
  completedCount: number;
  feedbackCount: number;
} {
  const rawLessonId = typeof input === "string" ? input : input.lessonId;
  const lessonId = rawLessonId === "sensor-avoid" ? "sensor-branch" : rawLessonId === "loop-turn" ? "repeat-route" : rawLessonId;
  const lesson = getLessonById(lessonId);
  const completedCount =
    typeof input === "string" ? lesson.order - 1 : Number.isFinite(input.completedCount) ? Math.max(0, Math.trunc(input.completedCount ?? 0)) : lesson.order - 1;
  const feedbackCount =
    typeof input === "string" ? 0 : Number.isFinite(input.feedbackCount) ? Math.max(0, Math.trunc(input.feedbackCount ?? 0)) : 0;

  return { lessonId: lesson.id, completedCount, feedbackCount };
}

export function buildLearningGoalSummary(input: LearningGoalSummaryInput): CodingStudioLearningGoalSummary {
  const { lessonId, completedCount, feedbackCount } = resolveSummaryInput(input);
  const lesson = getLessonById(lessonId);
  const rubric = CODING_STUDIO_RUBRIC_SCHEMA[lessonId];
  const criterionLine = rubric?.criteria[0]?.studentLine ?? lesson.retryHint;
  const whyThisMatters = lesson.whyThisMatters || rubric?.learningGoal || lesson.goalLine;

  return {
    title: `현재 학습 초점 · ${lesson.title}`,
    whyThisMatters,
    momentumLine: `피드백 ${feedbackCount}개 기준으로 ${lesson.assessmentFocus}을(를) 점검합니다.`,
    progressLine: `진행 ${Math.min(completedCount, lesson.order)}/${lesson.order}`,
    currentPractice: rubric ? `${rubric.learningGoal} · 관찰 포인트: ${lesson.sceneObservation}` : lesson.goalLine,
    refineFocus: `이번에 다시 다듬을 부분: ${criterionLine}`,
    nextBridge: `다음에 이어서 해볼 것: ${lesson.nextLessonPrompt}`,
  };
}
