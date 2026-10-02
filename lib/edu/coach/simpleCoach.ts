export type SimpleCoachResult = {
  title: string;
  tips: [string, string, string];
  actions: Array<{ label: string; value: string }>;
};

type SimpleCoachInput = {
  text: string;
  lessonId?: number;
  mode?: "chat" | "template";
  reason?: "rate_limit";
};

const BASE_TIPS: [string, string, string] = [
  "무엇을 만들고 싶은지 한 줄로 말해줘.",
  "원하는 모습이나 기능을 짧게 적어줘.",
  "오류 메시지가 있으면 그대로 붙여줘.",
];

const SHORT_INPUT_TIPS: [string, string, string] = [
  "조금 더 구체적으로 한 줄만 추가해줘.",
  "어떤 화면인지 한 문장으로 적어줘.",
  "필요하면 오류 메시지를 그대로 붙여줘.",
];

const ERROR_FOCUSED_TIPS: [string, string, string] = [
  "오류 메시지를 그대로 붙여줘.",
  "어떤 단계에서 멈췄는지 한 줄로 알려줘.",
  "원래 기대한 결과를 짧게 말해줘.",
];

const RATE_LIMIT_TIPS: [string, string, string] = [
  "질문을 한 문장으로 짧게 줄여볼까?",
  "지금 목표를 한 줄로 적어줘.",
  "오류 메시지가 있으면 그대로 붙여줘.",
];

const ACTIONS: Array<{ label: string; value: string }> = [
  { label: "목표 한 줄 적기", value: "만들고 싶은 것을 한 줄로 적어볼게." },
  { label: "오류 메시지 붙이기", value: "지금 보이는 오류 메시지를 그대로 붙여볼게." },
  { label: "현재 상황 설명하기", value: "지금 화면에서 어떤 점이 어려운지 한 줄로 설명해볼게." },
];

const hasErrorSignal = (text: string) => /오류|에러|error|fail|실패/i.test(text);

export function simpleCoach({ text, lessonId, mode, reason }: SimpleCoachInput): SimpleCoachResult {
  const trimmed = text.trim();
  const isShort = trimmed.length < 12;
  const errorHint = hasErrorSignal(trimmed);
  const tips =
    reason === "rate_limit"
      ? RATE_LIMIT_TIPS
      : errorHint
        ? ERROR_FOCUSED_TIPS
        : isShort
          ? SHORT_INPUT_TIPS
          : BASE_TIPS;
  const title = errorHint
    ? "오류 해결을 빨리 도와줄게요!"
    : mode === "template"
      ? "템플릿을 쉽게 채우는 팁이에요."
      : "먼저 한 줄만 정리해볼까요?";
  const actionSeed = lessonId ? ACTIONS : ACTIONS;
  return {
    title,
    tips,
    actions: actionSeed.slice(0, 3),
  };
}
