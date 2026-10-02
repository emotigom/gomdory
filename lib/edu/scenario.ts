export type LessonId = 1 | 2 | 3 | 4;

export type ScenarioStep = {
  message: string;
  ctaType: "none" | "focus" | "generate" | "present";
  ctaLabel?: string;
};

const SCENARIO_STEPS: Record<LessonId, ScenarioStep[]> = {
  1: [
    {
      message:
        "1교시 미션: ‘나를 소개하는 1페이지’를 만들어요. 이름/취미/좋아하는 것 1개를 적어봐요.",
      ctaType: "focus",
      ctaLabel: "집중 모드",
    },
    {
      message: "AI 코치에게: ‘내 이름은 …, 취미는 …, 좋아하는 건 …’이라고 말해보세요.",
      ctaType: "none",
    },
    {
      message: "준비되면 ‘웹사이트 만들기’를 눌러 파일로 만들어요.",
      ctaType: "generate",
      ctaLabel: "웹사이트 만들기",
    },
    {
      message: "완성되면 ‘게시하기’로 공유해요. (틀리면 다시 템플릿으로 시작해도 OK)",
      ctaType: "none",
    },
  ],
  2: [
    {
      message: "2교시 미션: ‘나의 하루’를 간단한 타임라인으로 적어요. 아침/점심/저녁 한 줄씩!",
      ctaType: "focus",
      ctaLabel: "집중 모드",
    },
    {
      message: "AI 코치에게 하루 이야기를 말해요. ‘아침엔…, 점심엔…, 저녁엔…’",
      ctaType: "none",
    },
    {
      message: "준비되면 ‘웹사이트 만들기’를 눌러요.",
      ctaType: "generate",
      ctaLabel: "웹사이트 만들기",
    },
    {
      message: "완성되면 ‘게시하기’로 공유하고 친구 작품도 봐요.",
      ctaType: "none",
    },
  ],
  3: [
    {
      message: "3교시 미션: ‘나의 꿈 직업’ 소개 페이지를 만들어요. 이유 1가지 포함!",
      ctaType: "focus",
      ctaLabel: "집중 모드",
    },
    {
      message: "AI 코치에게 꿈 직업을 설명해요. ‘나는 …가 되고 싶어요. 이유는 …’",
      ctaType: "none",
    },
    {
      message: "‘웹사이트 만들기’로 초안을 만들고 문장을 다듬어요.",
      ctaType: "generate",
      ctaLabel: "웹사이트 만들기",
    },
    {
      message: "마무리되면 ‘게시하기’로 공유해요. 서로 응원 한마디!",
      ctaType: "none",
    },
  ],
  4: [
    {
      message: "4교시 미션: 지금까지 만든 내용을 정리해 ‘최종 소개 페이지’를 완성해요.",
      ctaType: "focus",
      ctaLabel: "집중 모드",
    },
    {
      message: "AI 코치에게 마지막 수정 요청을 해요. ‘문장을 더 멋지게 해줘’",
      ctaType: "none",
    },
    {
      message: "준비되면 ‘웹사이트 만들기’를 눌러 최종본을 만들어요.",
      ctaType: "generate",
      ctaLabel: "웹사이트 만들기",
    },
    {
      message: "완성 후 ‘게시하기’로 공유하고 발표 준비!",
      ctaType: "none",
    },
  ],
};

export function getScenarioSteps(lessonId: LessonId): ScenarioStep[] {
  return SCENARIO_STEPS[lessonId];
}
