import { LESSON_03_04_VIBE_CODING_CONTENT } from "@/lib/edu/vibe-coding/lesson-03-04-content";

const forbidden = LESSON_03_04_VIBE_CODING_CONTENT.safetyChecklist.forbidden;

const findForbidden = (item: string) => forbidden.find((entry) => entry.includes(item)) ?? item;

export const VIBE_LAUNCHPAD_COPY = {
  lesson03Submission:
    "Gemini로 만든 앱 아이디어와 Lovable용 프롬프트를 Gomdory 카드로 제출하세요.\n앱 이름, 사용자, 주요 기능, 화면 구성, 제한 조건을 반드시 포함하세요.",
  lesson04Submission:
    "Lovable 결과물 링크를 Gomdory에 제출하세요.\n링크가 없으면 화면 설명 또는 실패 기록을 제출해도 됩니다.\n백업 도구를 쓴 경우 사용한 도구명도 함께 적으세요.",
  privacyWarning: `${findForbidden("실명")}, ${findForbidden("전화번호")}, ${findForbidden("주소")}, ${findForbidden("학교명")}, ${findForbidden("학년/반/번호")}, ${findForbidden("얼굴 사진")}, ${findForbidden("가족 정보")}, ${findForbidden("친구의 개인정보")}는 입력하지 않습니다.`,
  fallbackInstruction:
    "Lovable/Gemini가 막힌 지점, 입력한 프롬프트, 다음에 고치고 싶은 요청을 실패 기록으로 제출하세요.",
} as const;
