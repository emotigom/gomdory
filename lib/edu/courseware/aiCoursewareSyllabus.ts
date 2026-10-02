import { AI_COURSEWARE_MAX_DAY, AI_COURSEWARE_MIN_DAY } from "@/lib/edu/courseware/aiCoursewareRoutes";

export type AiCoursewareStudioMode = "html-css-js" | "prompt-card" | "planning-board" | "reflection" | "showcase";
export type AiCoursewarePhase = "intro" | "explore" | "build" | "revise" | "publish";
export type AiCoursewareInteractiveType = "bingo" | "quiz" | "sort" | "checklist";
export type AiCoursewareDay = {
  day: number;
  title: string;
  subtitle: string;
  durationMinutes: number;
  expansionMinutes: number;
  phase: AiCoursewarePhase;
  goals: string[];
  teacherOpeningScript: string;
  lessonFlow: { minutes: string; title: string; teacherAction: string; studentAction: string }[];
  extensionFlow: { minutes: string; title: string; teacherAction: string; studentAction: string }[];
  studentMission: { title: string; brief: string; steps: string[]; successCriteria: string[]; extensionChallenge: string };
  interactiveActivity?: {
    type: AiCoursewareInteractiveType;
    title: string;
    instructions: string;
    items: string[];
    targetCount?: number;
  };
  notebookLab: {
    title: string;
    summary: string;
    launchUrl: string;
    notebookJson: string;
    tasks: string[];
  };
  studio: { mode: AiCoursewareStudioMode; starterHtml?: string; starterCss?: string; starterJs?: string; promptTemplate?: string; checklist: string[] };
  reflectionPrompts: string[];
  teacherNotes: string[];
  nextConnection: string;
};

const PHASE_BY_DAY: AiCoursewarePhase[] = Array.from({ length: AI_COURSEWARE_MAX_DAY }, (_, i) => {
  const day = i + 1;
  if (day <= 4) return "intro";
  if (day <= 8) return "explore";
  if (day <= 24) return "build";
  if (day <= 28) return "revise";
  return "publish";
});

const MODE_BY_DAY: AiCoursewareStudioMode[] = Array.from({ length: AI_COURSEWARE_MAX_DAY }, (_, i) => {
  const day = i + 1;
  if ([6, 7, 14, 18, 22].includes(day)) return "prompt-card";
  if ([13, 15, 16, 19, 23, 25, 26, 28].includes(day)) return "planning-board";
  if ([27, 30].includes(day)) return "reflection";
  if ([29, 31, 32].includes(day)) return "showcase";
  return "html-css-js";
});

const TOPICS = ["AI와 사람의 역할", "좋은 질문 만들기", "정보 확인 습관", "작은 웹 결과물", "서비스 아이디어", "데이터와 패턴", "대화형 상호작용", "포트폴리오 정리"];
const DAY16_TITLES = [
  "생활 속 AI 빙고",
  "AI와 사람 역할 구분",
  "질문법 기초",
  "문장 고치기",
  "학교 문제 찾기",
  "주제 문장 만들기",
  "첫 화면 설계",
  "좋은 웹 체크",
  "데이터 형태 이해",
  "3문항 설문",
  "그래프 만들기",
  "한 문장 인사이트",
  "추천 규칙",
  "나만의 추천기",
  "분류 AI 체험",
  "AI 오류 개선",
] as const;

function starter(day: number) {
  return {
    starterHtml: `<main>\n  <h1>Day ${day} 결과물</h1>\n  <p id=\"result\">오늘의 주제: ${TOPICS[(day - 1) % TOPICS.length]}</p>\n  <button id=\"btn\">변경하기</button>\n</main>`,
    starterCss: `body { font-family: system-ui; padding: 16px; }\nmain { border: 2px solid #0f172a; border-radius: 12px; padding: 16px; }\nbutton { margin-top: 12px; padding: 8px 12px; }`,
    starterJs: `const btn = document.getElementById('btn');\nconst result = document.getElementById('result');\nbtn?.addEventListener('click', () => {\n  result.textContent = '내가 수정한 Day ${day} 메시지';\n});`,
  };
}

function createNotebookTemplate(day: number, topic: string) {
  return JSON.stringify(
    {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
        language_info: { name: "python" },
      },
      cells: [
        {
          cell_type: "markdown",
          metadata: {},
          source: [`# Day ${day} ML Lab\\n`, `주제: ${topic}\\n`, "웹 Jupyter Notebook에서 실행해보세요."],
        },
        {
          cell_type: "code",
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [
            "import pandas as pd\\n",
            "from sklearn.model_selection import train_test_split\\n",
            "from sklearn.tree import DecisionTreeClassifier\\n",
            "\\n",
            "data = pd.DataFrame({\\n",
            "    'study_min': [20, 30, 40, 50, 60, 70, 80, 90],\\n",
            "    'sleep_hour': [6, 7, 7, 8, 8, 7, 9, 8],\\n",
            "    'quiz_ready': [0, 0, 0, 1, 1, 1, 1, 1]\\n",
            "})\\n",
            "X = data[['study_min', 'sleep_hour']]\\n",
            "y = data['quiz_ready']\\n",
            "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)\\n",
            "model = DecisionTreeClassifier(max_depth=3, random_state=42)\\n",
            "model.fit(X_train, y_train)\\n",
            "print('정확도:', model.score(X_test, y_test))\\n",
          ],
        },
      ],
    },
    null,
    2,
  );
}

export const AI_COURSEWARE_32_DAY_SYLLABUS: AiCoursewareDay[] = Array.from({ length: AI_COURSEWARE_MAX_DAY }, (_, i) => {
  const day = i + 1;
  const phase = PHASE_BY_DAY[i];
  const mode = MODE_BY_DAY[i];
  const topic = TOPICS[(day - 1) % TOPICS.length];
  const isMiddleSchoolTrack = day <= 16;
  const dayTitle = isMiddleSchoolTrack ? DAY16_TITLES[day - 1] : topic;
  const lessonFlow = isMiddleSchoolTrack
    ? [
        { minutes: "0-10", title: "관심 열기", teacherAction: "실생활 사례/짧은 영상으로 몰입 시작", studentAction: "오늘 주제와 연결되는 경험 1개 공유" },
        { minutes: "10-25", title: "핵심 개념 미니레슨", teacherAction: "예시 중심 설명 + 오개념 체크", studentAction: "핵심 용어 2개를 내 말로 정리" },
        { minutes: "25-45", title: "인터랙티브 활동", teacherAction: "게임/퀴즈/분류 활동 진행", studentAction: "조별 상호작용 활동 수행 및 기록" },
        { minutes: "45-65", title: "실습 스프린트 1", teacherAction: "산출물 시작점 피드백", studentAction: "초안 작성 + 1차 실행 확인" },
        { minutes: "65-82", title: "실습 스프린트 2", teacherAction: "개별 코칭 및 확장 미션 제시", studentAction: "개선 반영 + 결과물 정리" },
        { minutes: "82-90", title: "공유/정리", teacherAction: "핵심 팀 발표 및 정리 질문", studentAction: "퇴장 티켓과 다음 차시 목표 작성" },
      ]
    : [
        { minutes: "0-5", title: "도입 훅", teacherAction: "짧은 사례 1개 제시", studentAction: "오늘 해결할 질문 1개 작성" },
        { minutes: "5-12", title: "미니 설명", teacherAction: "핵심 개념 + 안전 규칙 설명", studentAction: "핵심 단어 2개 메모" },
        { minutes: "12-28", title: "제작 스프린트 1", teacherAction: "템플릿 시작점 안내", studentAction: "초안 작성 및 1차 실행" },
        { minutes: "28-38", title: "수정 스프린트 2", teacherAction: "검증 질문 제공", studentAction: "오류/근거 보강 후 개선" },
        { minutes: "38-45", title: "공유/정리", teacherAction: "2팀 발표 + 피드백", studentAction: "결과물 공유, 퇴장 티켓 작성" },
      ];

  const interactiveActivity =
    day === 1
      ? {
          type: "bingo" as const,
          title: "생활 속 AI 빙고 게임",
          instructions: "칸을 클릭해 AI 사례를 찾고, 가로/세로/대각선 3줄 이상 완성해보세요.",
          items: ["추천 영상", "번역 앱", "얼굴 잠금해제", "길찾기", "음성 비서", "스팸 필터", "스마트 급식카드", "자동 자막", "음악 추천"],
          targetCount: 3,
        }
      : {
          type: day % 3 === 0 ? "quiz" as const : "checklist" as const,
          title: `${dayTitle} 인터랙티브 활동`,
          instructions: "활동 항목을 체크하고 조별로 근거를 비교해보세요.",
          items: ["핵심 개념 찾기", "실수 사례 분석", "안전 점검 질문 답하기", "우리 팀 개선안 1개 작성", "다른 팀 결과 피드백"],
          targetCount: 4,
        };

  const notebookTasks = [
    "샘플 데이터를 실행해 모델 정확도를 확인한다.",
    "변수(예: study_min)를 바꾸어 결과 변화를 관찰한다.",
    "오늘 수업 주제와 연결된 데이터 3행을 추가해 다시 실행한다.",
  ];

  return {
    day,
    title: `Day ${day} · ${dayTitle}`,
    subtitle: isMiddleSchoolTrack ? `${phase.toUpperCase()} 단계 수업: 2차시(90분) 운영 + 확장 활동 설계` : `${phase.toUpperCase()} 단계 수업: 45분 동안 작은 결과물을 완성합니다.`,
    durationMinutes: isMiddleSchoolTrack ? 90 : 45,
    expansionMinutes: isMiddleSchoolTrack ? 20 : 10,
    phase,
    goals: [
      `${dayTitle} 핵심 개념을 한 문장으로 설명한다.`,
      "팀/개인 미션을 단계별로 실행한다.",
      "안전·검증 체크 1개 이상을 통과한다.",
      "수업 종료 전 보이는 산출물을 남긴다.",
    ],
    teacherOpeningScript: `오늘은 Day ${day}입니다. AI 제안을 그대로 복사하지 말고, 반드시 내 판단 근거를 남깁니다.`,
    lessonFlow,
    extensionFlow: isMiddleSchoolTrack
      ? [
          { minutes: "90-100", title: "심화 데이터 확장", teacherAction: "추가 데이터 입력 미션 제시", studentAction: "데이터 5행 추가 후 재실행" },
          { minutes: "100-110", title: "모델 개선 토론", teacherAction: "왜 성능이 달라졌는지 질문", studentAction: "근거 기반 개선 아이디어 정리" },
        ]
      : [{ minutes: "45-55", title: "확장 챌린지", teacherAction: "선택형 확장 과제 안내", studentAction: "추가 기능 1개 시도" }],
    studentMission: {
      title: `${dayTitle} 미션 카드`,
      brief: `Day ${day} 결과물은 화면에서 확인 가능한 텍스트/상호작용 1개와 실습 로그를 포함해야 합니다.`,
      steps: ["시작 템플릿 열기", "문장/스타일/동작 중 최소 2개 수정", "안전 점검 문장 1개 기록", "결과물 저장/복사"],
      successCriteria: ["수업 내 실행 가능", "개인정보 없음", "AI 도움과 내 판단이 구분됨"],
      extensionChallenge: "남는 시간에는 사용자를 위한 안내 문구를 추가하고 접근성(색 대비/버튼 라벨)을 개선하세요.",
    },
    interactiveActivity,
    notebookLab: {
      title: `Day ${day} Python-ML 웹 노트북`,
      summary: "브라우저에서 바로 실행 가능한 JupyterLite 기반 실습입니다.",
      launchUrl: "https://jupyterlite.github.io/demo/lab/index.html",
      notebookJson: createNotebookTemplate(day, dayTitle),
      tasks: notebookTasks,
    },
    studio: {
      mode,
      ...(mode === "html-css-js" ? starter(day) : {}),
      promptTemplate: mode !== "html-css-js" ? `주제: ${dayTitle}\n목표: 중학생 수준 설명\n검증 질문: 이 내용은 왜 믿을 수 있나요?` : undefined,
      checklist: ["보이는 결과가 있는가", "출처/근거를 말할 수 있는가", "개인정보가 없는가", "오늘 배운 점을 한 줄로 적었는가"],
    },
    reflectionPrompts: ["AI가 도와준 부분과 내가 판단한 부분은 무엇인가요?", "오늘 결과물의 가장 강한 점 1가지는?", "다음 시간에 개선할 점은?"],
    teacherNotes: ["실명/연락처 입력 금지 안내를 다시 확인하세요.", "빠른 팀에는 확장 챌린지, 느린 팀에는 최소 달성 기준을 제공합니다.", "발표는 결과물 화면 + 판단 근거 순서로 진행하세요."],
    nextConnection: `Day ${Math.min(day + 1, AI_COURSEWARE_MAX_DAY)}에서는 오늘 결과물을 바탕으로 다음 단계 산출물을 확장합니다.`,
  };
});

export const getAiCoursewareDay = (day: number) => AI_COURSEWARE_32_DAY_SYLLABUS.find((item) => item.day === day) ?? null;
export const isValidAiCoursewareDay = (day: number) => day >= AI_COURSEWARE_MIN_DAY && day <= AI_COURSEWARE_MAX_DAY;
