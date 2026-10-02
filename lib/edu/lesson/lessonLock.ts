export type LessonId = "P1" | "P2" | "P3" | "P4";

export type LessonLock = {
  enabled: boolean;
  lessonId: LessonId;
  version: 1;
};

export type LessonSpec = {
  lessonId: LessonId;
  title: string;
  goals: string[];
  mustInclude: string[];
  mustAvoid: string[];
  outputStyle: {
    coachTone: "student-friendly";
    coachMaxSentences: 3;
    noMarkdown: true;
    koreanOnly: true;
  };
  buildPolicy: {
    allowSiteBuild: true;
    requireActionReady: true;
  };
  insurancePrompt: string;
};

const COMMON_OUTPUT_STYLE: LessonSpec["outputStyle"] = {
  coachTone: "student-friendly",
  coachMaxSentences: 3,
  noMarkdown: true,
  koreanOnly: true,
};

const COMMON_BUILD_POLICY: LessonSpec["buildPolicy"] = {
  allowSiteBuild: true,
  requireActionReady: true,
};

const LESSON_SPECS: Record<LessonId, LessonSpec> = {
  P1: {
    lessonId: "P1",
    title: "1교시: 자기소개",
    goals: ["자기소개 페이지 핵심 요소를 정리한다", "학생이 준 정보만으로 소개 구성을 만든다"],
    mustInclude: ["이름", "취미", "사진 자리", "한줄 슬로건", "프로필 카드 3개"],
    mustAvoid: [
      "나이/학과/팀원활동/모르는 정보 생성",
      "가나/일본어",
      "마크다운",
      "영어로 인식합니다 같은 메타발언",
    ],
    outputStyle: COMMON_OUTPUT_STYLE,
    buildPolicy: COMMON_BUILD_POLICY,
    insurancePrompt:
      "자기소개 한 장짜리 웹페이지를 만들어요. 이름: __, 취미: __. 사진 자리와 한줄 슬로건, 프로필 카드 3개를 넣어줘.",
  },
  P2: {
    lessonId: "P2",
    title: "2교시: 관심사 탐구",
    goals: ["관심사 주제와 이유를 정리한다", "카드/타임라인으로 탐구 흐름을 구성한다"],
    mustInclude: ["관심 주제", "관심 이유", "정보 카드 3개 이상", "타임라인 3단계", "한 줄 Q/A"],
    mustAvoid: ["외부 링크/이미지 요구", "가나/일본어", "마크다운", "학생이 주지 않은 개인정보 생성"],
    outputStyle: COMMON_OUTPUT_STYLE,
    buildPolicy: COMMON_BUILD_POLICY,
    insurancePrompt: "관심사 탐구 페이지를 만들어요. 관심 주제와 이유, 정보 카드 3개, 타임라인 3단계, 한 줄 Q/A를 넣어줘.",
  },
  P3: {
    lessonId: "P3",
    title: "3교시: 퀴즈/미니게임",
    goals: ["퀴즈 질문과 선택지를 구성한다", "점수/피드백을 제공하는 흐름을 만든다"],
    mustInclude: ["퀴즈 3문항 이상", "선택지 3개 이상", "정답/설명", "결과 메시지"],
    mustAvoid: ["네트워크 요청", "외부 리소스 사용", "가나/일본어", "마크다운"],
    outputStyle: COMMON_OUTPUT_STYLE,
    buildPolicy: COMMON_BUILD_POLICY,
    insurancePrompt: "퀴즈 페이지를 만들어요. 질문 3개, 선택지 3개, 정답 설명, 결과 메시지를 넣어줘.",
  },
  P4: {
    lessonId: "P4",
    title: "4교시: 작품 전시",
    goals: ["작품 전시/갤러리 구성을 만든다", "대표 작품과 링크 자리 안내를 제공한다"],
    mustInclude: ["갤러리 카드 6개 이상", "대표 작품 영역", "링크 자리 라벨"],
    mustAvoid: ["외부 링크 자동 입력", "가나/일본어", "마크다운", "학생이 주지 않은 개인정보 생성"],
    outputStyle: COMMON_OUTPUT_STYLE,
    buildPolicy: COMMON_BUILD_POLICY,
    insurancePrompt: "작품 전시 페이지를 만들어요. 갤러리 카드 6개와 대표 작품 자리, 링크 붙이기 라벨을 넣어줘.",
  },
};

export function getLessonSpec(lessonId: LessonId): LessonSpec {
  return LESSON_SPECS[lessonId];
}

export function getLessonIdFromNumber(lessonId: number): LessonId | null {
  if (lessonId === 1) return "P1";
  if (lessonId === 2) return "P2";
  if (lessonId === 3) return "P3";
  if (lessonId === 4) return "P4";
  return null;
}
