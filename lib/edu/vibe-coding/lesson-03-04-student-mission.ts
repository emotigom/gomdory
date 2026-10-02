import { isVibeCodingLessonTemplateId } from "@/lib/edu/vibe-coding/lesson-03-04-ids";

export type VibeCodingStudentMission = {
  title: string;
  subtitle: string;
  steps: string[];
  recommendedTemplates: string[];
  safetyLine: string;
};

const SAFETY_LINE = "실명, 전화번호, 주소, 학교명, 얼굴 사진은 넣지 마세요.";

export function getVibeCodingStudentMission(templateId: unknown): VibeCodingStudentMission | null {
  if (!isVibeCodingLessonTemplateId(templateId)) {
    return null;
  }

  if (templateId === "lesson_03_vibe_app_planning") {
    return {
      title: "오늘의 미션: Gemini로 앱 기획하기",
      subtitle: "Gemini로 앱 아이디어와 Lovable용 프롬프트를 정리한 뒤 카드로 제출하세요.",
      steps: [
        "Gemini Apps에서 해결할 문제와 앱 아이디어를 정리합니다.",
        "누구에게 어떤 도움을 주는지 적습니다.",
        "주요 기능 3가지를 정리합니다.",
        "Gemini Apps로 Lovable용 프롬프트를 다듬습니다.",
        "카드 작성에서 ‘앱 아이디어’ 또는 ‘AI 프롬프트’ 버튼을 눌러 제출합니다.",
      ],
      recommendedTemplates: ["앱 아이디어", "AI 프롬프트"],
      safetyLine: SAFETY_LINE,
    };
  }

  return {
    title: "오늘의 미션: Lovable 프로토타입 제작",
    subtitle: "Lovable로 만든 결과물 링크, 화면 설명, 또는 실패 기록을 제출하세요.",
    steps: [
      "지난 시간에 만든 프롬프트를 확인합니다.",
      "Lovable로 프로토타입 제작을 먼저 시도합니다.",
      "링크가 있으면 URL 칸에 붙여넣습니다.",
      "링크가 없으면 Canva/Bolt/Replit/v0 중 백업 도구 결과 또는 실패 기록을 남깁니다.",
      "친구 작품을 보고 피드백을 남깁니다.",
    ],
    recommendedTemplates: ["작품 링크", "Canva 시안", "실패 기록", "친구 피드백"],
    safetyLine: SAFETY_LINE,
  };
}
