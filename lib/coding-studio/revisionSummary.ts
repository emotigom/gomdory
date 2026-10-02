import type { CodingStudioSubmissionSnapshot } from "./submissionSchema";

export type CodingStudioRevisionComparisonSummary = {
  changedOutcome: boolean;
  outcomeLine: string;
  goalDistanceDelta: number;
  goalDistanceLine: string;
  structureChanged: boolean;
  structureLine: string;
  successChanged: boolean;
  successLine: string;
};

export type CodingStudioRevisionSummary = {
  previousSubmissionId: string | null;
  reworkSourceSubmissionId: string | null;
  newSubmissionId: string;
  comparison: CodingStudioRevisionComparisonSummary;
  linkedGoalLabels: string[];
  linkedGoalLine: string;
};

export function buildRevisionSummary(args: {
  previous: CodingStudioSubmissionSnapshot | null;
  reworkSourceSubmissionId: string | null;
  current: CodingStudioSubmissionSnapshot;
  linkedGoalLabels?: string[];
}): CodingStudioRevisionSummary | null {
  const { previous, current, reworkSourceSubmissionId } = args;
  if (!previous) return null;

  const changedOutcome = previous.evidence.outcome !== current.evidence.outcome;
  const goalDistanceDelta = Number((previous.evidence.scene.goalDistance - current.evidence.scene.goalDistance).toFixed(2));
  const structureChanged =
    previous.evidence.structure.repeatCount !== current.evidence.structure.repeatCount ||
    previous.evidence.structure.sensorCount !== current.evidence.structure.sensorCount;
  const successChanged = previous.evidence.runtime.reachedGoal !== current.evidence.runtime.reachedGoal;

  return {
    previousSubmissionId: previous.submissionId,
    reworkSourceSubmissionId,
    newSubmissionId: current.submissionId,
    comparison: {
      changedOutcome,
      outcomeLine: changedOutcome
        ? `결과 흐름이 ${previous.evidence.outcome} → ${current.evidence.outcome}로 개선/변화되었어요.`
        : "결과 유형은 같지만, 내부 전략 품질을 비교해 볼 수 있어요.",
      goalDistanceDelta,
      goalDistanceLine:
        goalDistanceDelta > 0
          ? `목표까지 거리가 ${goalDistanceDelta}만큼 가까워졌어요. 관찰-수정 루프가 잘 작동했습니다.`
          : goalDistanceDelta < 0
            ? `목표까지 거리가 ${Math.abs(goalDistanceDelta)}만큼 멀어졌어요. 수정 기준을 한 가지로 좁혀 다시 시도해 보세요.`
            : "목표까지 거리는 동일해요. 구조 조정이 실제 결과를 바꾸는지 추가 확인해 보세요.",
      structureChanged,
      structureLine: structureChanged
        ? `반복/감지 구조가 ${previous.evidence.structure.repeatCount}/${previous.evidence.structure.sensorCount} → ${current.evidence.structure.repeatCount}/${current.evidence.structure.sensorCount}로 바뀌었어요.`
        : "반복/감지 구조는 동일해요. 각도·거리 같은 세부 파라미터 조정이 핵심입니다.",
      successChanged,
      successLine: successChanged
        ? `목표 도달 상태가 ${previous.evidence.runtime.reachedGoal ? "도달" : "미도달"} → ${current.evidence.runtime.reachedGoal ? "도달" : "미도달"}로 달라졌어요.`
        : "목표 도달 상태는 같아요. 다음 제출에서는 근거 문장을 더 명확히 남겨 보세요.",
    },
    linkedGoalLabels: (args.linkedGoalLabels ?? []).slice(0, 2),
    linkedGoalLine:
      args.linkedGoalLabels && args.linkedGoalLabels.length > 0
        ? `이번 수정은 ${args.linkedGoalLabels.slice(0, 2).join(", ")} 목표를 중심으로 이어졌어요.`
        : "이번 수정은 핵심 목표 한두 가지를 중심으로 차분히 이어졌어요.",
  };
}
