export const LESSON_ACTIVITY_TYPES = [
  "ai_bingo",
  "ai_judgment_sort",
  "web_coding_lite",
  "python_studio_lite",
] as const;

export type LessonActivityType = (typeof LESSON_ACTIVITY_TYPES)[number];

export type LessonActivityPlaceholderKey =
  | LessonActivityType
  | "simple_code_intro"
  | "vibe_app_planning"
  | "vibe_prompt_design"
  | "vibe_prototype_build"
  | "vibe_submission_reflection";

export type LessonActivityDefinition = {
  type: LessonActivityType;
  title: string;
  shortTitle: string;
  description: string;
  studentReadyLabel: string;
};

export type LessonTemplateActivity = {
  key: LessonActivityPlaceholderKey;
  title: string;
  status: "scaffold" | "placeholder";
  activityType?: LessonActivityType;
};

export type LessonTemplate = {
  id:
    | "lesson_01_ai_intro_python_first_steps"
    | "lesson_02_ai_judgment_if_else"
    | "lesson_03_vibe_app_planning"
    | "lesson_04_vibe_app_prototype_share";
  title: string;
  summary: string;
  activities: LessonTemplateActivity[];
};

export const LESSON_ACTIVITY_DEFINITIONS: Record<LessonActivityType, LessonActivityDefinition> = {
  ai_bingo: {
    type: "ai_bingo",
    title: "AI Bingo Arena",
    shortTitle: "AI 빙고",
    description: "생활 속 AI 사례를 찾아 빙고판에 표시하는 교실 실습입니다.",
    studentReadyLabel: "AI 빙고 아레나 준비 중",
  },
  ai_judgment_sort: {
    type: "ai_judgment_sort",
    title: "AI vs Human Judgment Card Sort",
    shortTitle: "AI 판단 카드 분류",
    description: "AI가 잘하는 판단과 사람이 확인해야 하는 판단을 카드로 분류합니다.",
    studentReadyLabel: "AI 판단 카드 분류 준비 중",
  },
  web_coding_lite: {
    type: "web_coding_lite",
    title: "Web Studio Lite",
    shortTitle: "웹 코딩 실습",
    description: "HTML/CSS/JavaScript의 작은 결과물을 안전하게 만들어보는 웹 실습입니다.",
    studentReadyLabel: "웹 코딩 실습 준비 중",
  },
  python_studio_lite: {
    type: "python_studio_lite",
    title: "Python Studio Lite",
    shortTitle: "파이썬 실습실",
    description: "브라우저에서 파이썬 코드를 작성하고 실행 결과를 확인하는 안전한 기초 실습입니다.",
    studentReadyLabel: "파이썬 실습실 준비 중",
  },
} as const;

export const LESSON_TEMPLATES: readonly LessonTemplate[] = [
  {
    id: "lesson_01_ai_intro_python_first_steps",
    title: "1차시: 생활 속 AI와 파이썬 첫걸음",
    summary: "생활 속 AI 찾기, AI 빙고, 파이썬 print/input/변수/f-string 첫걸음을 한 흐름으로 묶는 준비 템플릿입니다.",
    activities: [
      {
        key: "ai_bingo",
        title: "1단계: AI 빙고",
        status: "scaffold",
        activityType: "ai_bingo",
      },
      {
        key: "python_studio_lite",
        title: "2단계: 파이썬 첫걸음",
        status: "scaffold",
        activityType: "python_studio_lite",
      },
    ],
  },
  {
    id: "lesson_02_ai_judgment_if_else",
    title: "2차시: AI 판단과 if/else",
    summary: "판단 기준을 카드로 정리하고 조건문으로 표현하는 준비 템플릿입니다.",
    activities: [
      {
        key: "ai_judgment_sort",
        title: "1단계: AI 판단 카드 분류",
        status: "scaffold",
        activityType: "ai_judgment_sort",
      },
      {
        key: "python_studio_lite",
        title: "2단계: 파이썬 if/else 실습",
        status: "scaffold",
        activityType: "python_studio_lite",
      },
      {
        key: "web_coding_lite",
        title: "선택: 웹 코딩 체험",
        status: "placeholder",
        activityType: "web_coding_lite",
      },
    ],
  },
  {
    id: "lesson_03_vibe_app_planning",
    title: "3차시: Gemini로 AI 웹앱 기획과 프롬프트 설계",
    summary: "Gemini로 앱 아이디어와 Lovable용 프롬프트를 준비합니다.",
    activities: [
      {
        key: "vibe_app_planning",
        title: "1단계: 앱 아이디어 정리",
        status: "placeholder",
      },
      {
        key: "vibe_prompt_design",
        title: "2단계: AI 프롬프트 설계",
        status: "placeholder",
      },
    ],
  },
  {
    id: "lesson_04_vibe_app_prototype_share",
    title: "4차시: Lovable 프로토타입 제작과 제출",
    summary: "Canva 또는 Lovable로 프로토타입을 시도하고 결과물 링크, 시안, 실패 기록 중 하나를 제출합니다.",
    activities: [
      {
        key: "vibe_prototype_build",
        title: "1단계: Lovable 프로토타입 제작(백업: Canva/Bolt/Replit/v0)",
        status: "placeholder",
      },
      {
        key: "vibe_submission_reflection",
        title: "2단계: 결과물/실패 기록 제출",
        status: "placeholder",
      },
    ],
  },
] as const;

export function getLessonTemplate(templateId: LessonTemplate["id"]): LessonTemplate | null {
  return LESSON_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function isLessonActivityType(value: string): value is LessonActivityType {
  return (LESSON_ACTIVITY_TYPES as readonly string[]).includes(value);
}
