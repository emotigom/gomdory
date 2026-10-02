import { compileBlocksToIr, type StudioIrInstruction } from "./ir";
import { getLessonById } from "./lessons";
import type { CodingStudioAssessmentResult, LessonId, StudioBlockNode, StudioRuntimeState } from "./types";

function countInstruction(plan: StudioIrInstruction[], kind: StudioIrInstruction["kind"]): number {
  return plan.reduce((total, instruction) => {
    if (instruction.kind === kind) return total + 1;
    if (instruction.kind === "repeat" || instruction.kind === "if_sensor") {
      return total + countInstruction(instruction.children, kind);
    }
    return total;
  }, 0);
}

export function assessLessonCheckpoint(args: {
  lessonId: LessonId;
  runtimeState: StudioRuntimeState;
  blocks: StudioBlockNode[];
}): CodingStudioAssessmentResult {
  const lesson = getLessonById(args.lessonId);
  const compiled = compileBlocksToIr(args.blocks);
  const repeatCount = countInstruction(compiled, "repeat");
  const sensorCount = countInstruction(compiled, "if_sensor");
  const turnCount = countInstruction(compiled, "turn");
  const nearGoalDistance = Math.hypot(lesson.goal.x - args.runtimeState.x, lesson.goal.z - args.runtimeState.z);
  const isNearGoal = nearGoalDistance <= lesson.goal.radius + 0.9;

  if (lesson.kind === "preview") {
    return {
      lessonId: args.lessonId,
      completed: true,
      tone: "success",
      keyCondition: "다음 단계 안내 확인",
      summary: lesson.nextLessonPrompt,
      retryHint: lesson.retryHint,
      reflectionLine: lesson.completionReflection,
    };
  }

  if (args.runtimeState.reachedGoal) {
    return {
      lessonId: args.lessonId,
      completed: true,
      tone: "success",
      keyCondition: lesson.assessmentFocus,
      summary: lesson.successCondition,
      retryHint: lesson.nextLessonPrompt,
      reflectionLine: `${lesson.completionReflection} · ${lesson.ahaMoment}`,
    };
  }

  if (args.runtimeState.blocked || isNearGoal) {
    return {
      lessonId: args.lessonId,
      completed: false,
      tone: "near-success",
      keyCondition: lesson.assessmentFocus,
      summary: isNearGoal ? "핵심 경로는 맞았어요. 마지막 조정 한 번이면 도달할 수 있어요." : "전략은 맞지만 장애물 앞에서 멈췄어요. 분기 시점이나 회전 기준을 점검해 보세요.",
      retryHint: lesson.retryHint,
      reflectionLine: `관찰 포인트: ${lesson.sceneObservation}`,
    };
  }

  const structureHint =
    args.lessonId === "turn-pivot" && turnCount === 0
      ? "회전 블록이 없으면 경로 전환이 어렵습니다. 회전 시점을 먼저 정해 보세요."
      : args.lessonId === "repeat-route" && repeatCount === 0
        ? "반복 블록을 넣어 같은 패턴을 묶으면 수정이 쉬워집니다."
        : args.lessonId === "sensor-branch" && sensorCount === 0
          ? "감지 조건 블록을 먼저 배치해 장애물 앞 분기 흐름을 만들어 보세요."
          : args.lessonId === "sensor-branch" && turnCount === 0
            ? "감지 조건 안에 회전 블록을 넣어 회피 동작을 연결해 보세요."
            : args.lessonId === "strategy-tune" && repeatCount + sensorCount < 2
              ? "이번 단계는 전략 조합 연습입니다. 반복 또는 감지 구조를 포함해 보세요."
              : lesson.retryHint;

  return {
    lessonId: args.lessonId,
    completed: false,
    tone: "retry",
    keyCondition: lesson.assessmentFocus,
    summary: "아직 핵심 학습 조건이 충분히 실행되지 않았어요.",
    retryHint: structureHint,
    reflectionLine: `왜 이 실습을 하는지: ${lesson.whyThisMatters}`,
  };
}
