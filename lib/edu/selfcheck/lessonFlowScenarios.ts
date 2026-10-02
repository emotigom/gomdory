export type LessonFlowStep =
  | { type: "coach_chat"; prompt: string }
  | { type: "generator_create_files"; instruction: string }
  | { type: "generator_update_files"; instruction: string }
  | { type: "export_sim" };

export type LessonFlowScenario = {
  id: string;
  steps: LessonFlowStep[];
};

const coachPrefix = "반드시 한국어만 사용하고 한자/영어는 쓰지 마. (코드 제외)";

const flowRunnerScenarios: LessonFlowScenario[] = Array.from(
  { length: 10 },
  (_, index): LessonFlowScenario => {
    const runId = index + 1;
    return {
      id: `flow-run-${runId}`,
      steps: [
        {
          type: "coach_chat",
          prompt: `${coachPrefix}\n짧은 질문 1개로 오늘 기분을 물어봐 줘. (${runId}회차)`,
        },
        {
          type: "generator_create_files",
          instruction:
            "오늘 기분을 담은 content JSON을 만들어 줘. 제목/한 줄 설명/카드 3개를 포함해 줘.",
        },
        {
          type: "generator_update_files",
          instruction:
            "기존 content 구조를 유지하면서 표현을 더 짧고 간단하게 바꿔 줘.",
        },
        { type: "export_sim" },
      ],
    };
  },
);

export const lessonFlowScenarios: LessonFlowScenario[] = flowRunnerScenarios;
