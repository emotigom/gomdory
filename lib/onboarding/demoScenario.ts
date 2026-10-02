export type DemoScenarioStep = {
  title: string;
  description: string;
  seconds: number;
};

export type DemoScenario = {
  scenarioId: string;
  steps: DemoScenarioStep[];
};

export const DEMO_SCENARIO: DemoScenario = {
  scenarioId: "onboarding-demo-v1",
  steps: [
    {
      title: "워밍업",
      description: "출석 체크 / 오늘의 목표",
      seconds: 30,
    },
    {
      title: "활동",
      description: "질문 1개 제출 / 도움요청 버튼 써보기",
      seconds: 30,
    },
    {
      title: "정리",
      description: "한 줄 소감 / 다음 시간 예고",
      seconds: 30,
    },
  ],
};

export const DEMO_DEFAULT_ANNOUNCEMENT =
  "지금은 데모 수업입니다. 아래 버튼으로 질문/도움요청을 보내보세요.";

export const DEMO_ANNOUNCEMENTS = [
  "질문을 하나 남겨볼까요?",
  "도움이 필요하면 도움요청 버튼을 눌러주세요.",
  "마지막으로 한 줄 소감을 남겨주세요.",
];
