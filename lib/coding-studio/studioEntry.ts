export type CodingStudioEntrySource = "academy-free" | "academy-assigned" | "assigned-resume" | "free-practice";

type ReworkEntryArgs = {
  latestSubmissionExists: boolean;
  feedbackCount: number;
  primaryFocus: string | null;
};

export function shouldShowStudioFirstEntryOnboarding(args: { entry: string | null; dismissed: boolean }) {
  return args.entry === "academy" && !args.dismissed;
}

export function resolveCodingStudioEntrySource(args: { entry: string | null; hasActiveAssignment: boolean }): CodingStudioEntrySource {
  if (args.entry === "assignment") return "assigned-resume";
  if (args.entry === "academy") {
    return args.hasActiveAssignment ? "academy-assigned" : "academy-free";
  }
  return args.hasActiveAssignment ? "assigned-resume" : "free-practice";
}

export function resolveEntryNotice(source: CodingStudioEntrySource): { title: string; detail: string } {
  if (source === "academy-assigned") {
    return {
      title: "아카데미 준비를 지정 실습 경로로 이어갑니다.",
      detail: "현재 레슨의 목표와 관찰 포인트를 확인한 뒤, 한 가지 조정 근거로 다음 시도를 진행하세요.",
    };
  }
  if (source === "assigned-resume") {
    return {
      title: "이전 실습 흐름을 같은 맥락에서 다시 이어갑니다.",
      detail: "중단 지점부터 재개하되, 직전 제출 대비 달라질 한 항목을 먼저 정해 보세요.",
    };
  }
  if (source === "academy-free") {
    return {
      title: "아카데미에서 정리한 전략을 자유 실습으로 검증합니다.",
      detail: "원하는 레슨을 선택해 실행-관찰-수정 루프를 차분히 반복해 보세요.",
    };
  }
  return {
    title: "자유 실습 모드",
    detail: "정답보다 근거를 남기는 연습을 목표로, 한 번에 한 가지씩 조정해 봅시다.",
  };
}

export function resolveReworkEntryNotice(args: ReworkEntryArgs): { title: string; detail: string; focusLine: string } | null {
  if (!args.latestSubmissionExists || args.feedbackCount === 0) return null;
  return {
    title: "재제출 전, 다시 다듬기 포인트가 정리되어 있어요.",
    detail: `이전 제출 기준으로 교사 피드백 ${Math.min(args.feedbackCount, 3)}개가 연결되어 있습니다. 이번엔 한 가지 기준만 명확히 개선해 보세요.`,
    focusLine: args.primaryFocus ? `먼저 집중할 부분: ${args.primaryFocus}` : "먼저 집중할 부분: 핵심 조건 한 가지를 명확히 맞추기",
  };
}
