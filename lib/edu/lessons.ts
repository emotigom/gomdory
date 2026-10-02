export type LessonFile = {
  filename: string;
  content: string;
  contentType: "text/html" | "text/css" | "text/javascript";
};

export type LessonPreset = {
  id: 0 | 1 | 2 | 3 | 4;
  title: string;
  goal: string;
  description: string;
  starterPromptSuggestions: string[];
  requiredFiles: LessonFile[];
};

export type EduTemplateKey = "intro_basic" | "idol_card" | "portfolio_grid" | "three_runner";

export const EDU_TEMPLATE_OPTIONS: Array<{
  key: EduTemplateKey;
  label: string;
  lessonId: LessonPreset["id"];
}> = [
  { key: "intro_basic", label: "자기소개 기본 템플릿", lessonId: 1 },
  { key: "idol_card", label: "관심사 탐구 템플릿", lessonId: 2 },
  { key: "portfolio_grid", label: "퀴즈 템플릿", lessonId: 3 },
  { key: "three_runner", label: "작품 전시 템플릿", lessonId: 4 },
];

const TEMPLATE_KEY_TO_LESSON_ID = EDU_TEMPLATE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.lessonId;
    return acc;
  },
  {} as Record<EduTemplateKey, LessonPreset["id"]>,
);

const navTemplate = `
<nav class="site-nav">
  <div class="logo">My Web Class</div>
  <div class="links">
    <a href="index.html">Home</a>
  </div>
</nav>
`;

const baseStyles = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Pretendard", "Noto Sans KR", sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

.site-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: #0f172a;
  color: white;
}

.site-nav .links {
  display: flex;
  gap: 16px;
}

.site-nav a {
  color: white;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px;
}

.hero {
  background: white;
  padding: 32px;
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.1);
}

.card-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-top: 24px;
}

.card {
  background: #f1f5f9;
  padding: 16px;
  border-radius: 16px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  background: #0ea5e9;
  color: white;
  border-radius: 999px;
  font-weight: 600;
  text-decoration: none;
}

.banner {
  background: #fef3c7;
  border-radius: 20px;
  padding: 24px;
  margin-top: 24px;
}

.game-panel {
  background: #0f172a;
  color: white;
  padding: 24px;
  border-radius: 20px;
}

canvas {
  width: 100%;
  height: 320px;
  border-radius: 16px;
  background: radial-gradient(circle at top, #38bdf8, #1e293b);
}
`;

const buildHtml = (title: string, body: string) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    ${navTemplate}
    <main class="container">
      ${body}
    </main>
  </body>
</html>
`;

export const LESSON_PRESETS: LessonPreset[] = [
  {
    id: 0,
    title: "자유모드 · 빈 페이지",
    goal: "원하는 주제로 자유롭게 웹페이지를 만들어요.",
    description: "최소 스캐폴딩만 있는 빈 페이지에서 시작해요.",
    starterPromptSuggestions: [
      "빈 페이지에서 시작해서 내가 원하는 주제로 만들어줘",
      "헤더/본문/푸터만 있는 아주 간단한 템플릿을 만들어줘",
      "색상과 폰트를 내가 정할 수 있게 기본 구조만 만들어줘",
      "index.html과 style.css를 최소 구조로 정리해줘",
    ],
    requiredFiles: [
      {
        filename: "index.html",
        content: `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Free Lesson</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>자유모드</h1>
      <p>여기서부터 원하는 페이지를 만들어 보세요.</p>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`,
        contentType: "text/html",
      },
      {
        filename: "style.css",
        content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Pretendard", "Noto Sans KR", sans-serif;
  padding: 24px;
  background: #f8fafc;
  color: #0f172a;
}
`,
        contentType: "text/css",
      },
      {
        filename: "script.js",
        content: "",
        contentType: "text/javascript",
      },
    ],
  },
  {
    id: 1,
    title: "1교시 · 자기소개 페이지",
    goal: "나를 소개하는 한 장짜리 웹페이지를 완성해요.",
    description: "이름, 관심사, 좋아하는 색을 알려주는 프로필을 만들어요.",
    starterPromptSuggestions: [
      "내 이름은 OOO, 취미는 ...인 자기소개 페이지 만들어줘",
      "학교/학년/관심사 소개 + 프로필 카드 3개 있는 페이지 만들어줘",
      "좋아하는 색/음식/꿈 섹션이 있는 자기소개 페이지 만들어줘",
      "사진 자리(이미지 박스) + 한줄 슬로건이 있는 자기소개 만들어줘",
    ],
    requiredFiles: [
      {
        filename: "index.html",
        content: buildHtml(
          "My Intro",
          `
        <section class="hero">
          <h1>안녕하세요! 저는 민지예요 👋</h1>
          <p>코딩을 배우며 나만의 웹페이지를 만들고 있어요.</p>
          <div class="card-grid">
            <div class="card">
              <h3>나의 키워드</h3>
              <p>#호기심 #성장 #AI친구</p>
            </div>
            <div class="card">
              <h3>좋아하는 것</h3>
              <p>고양이, 파란색, 멜론빵</p>
            </div>
            <div class="card">
              <h3>오늘의 목표</h3>
              <p>나를 소개하는 첫 웹페이지 완성!</p>
            </div>
          </div>
        </section>
        <div class="banner">
          <h2>친구에게 한마디</h2>
          <p>내 웹페이지에 놀러 와줘요!</p>
        </div>
      `
        ),
        contentType: "text/html",
      },
      {
        filename: "style.css",
        content: baseStyles,
        contentType: "text/css",
      },
      {
        filename: "script.js",
        content: "",
        contentType: "text/javascript",
      },
    ],
  },
  {
    id: 2,
    title: "2교시 · 관심사 탐구 페이지",
    goal: "나의 관심사를 소개하는 탐구 페이지를 완성해요.",
    description: "관심 주제와 과정을 카드/타임라인으로 정리해요.",
    starterPromptSuggestions: [
      "관심 주제 + 이유 + 카드 3개 + 타임라인 3단계로 구성해줘",
      "탐구 질문/답변 섹션이 있는 페이지를 만들어줘",
      "관심사 소개 카드 4개와 과정 설명을 포함해줘",
      "밝고 깔끔한 탐구 페이지를 만들어줘",
    ],
    requiredFiles: [
      {
        filename: "index.html",
        content: buildHtml(
          "Interest Lab",
          `
        <section class="hero">
          <h1>나의 관심사 탐구</h1>
          <p>궁금한 주제를 카드와 과정으로 정리해요.</p>
        </section>
        <div class="banner">
          <h2>오늘의 질문</h2>
          <p>가장 궁금한 사실을 한 문장으로 정리해 보세요.</p>
        </div>
      `
        ),
        contentType: "text/html",
      },
      {
        filename: "style.css",
        content: baseStyles,
        contentType: "text/css",
      },
      {
        filename: "script.js",
        content: "",
        contentType: "text/javascript",
      },
    ],
  },
  {
    id: 3,
    title: "3교시 · 퀴즈/미니게임 페이지",
    goal: "클릭하면 점수가 올라가는 퀴즈 페이지를 만들어요.",
    description: "질문과 선택지를 구성하고 결과를 보여줘요.",
    starterPromptSuggestions: [
      "퀴즈 질문 3개 + 선택지 3개 + 정답 설명을 넣어줘",
      "점수판과 결과 메시지가 있는 퀴즈 페이지를 만들어줘",
      "게임처럼 보이는 퀴즈 UI를 만들어줘",
      "버튼 클릭으로 점수가 올라가는 페이지를 만들어줘",
    ],
    requiredFiles: [
      {
        filename: "index.html",
        content: buildHtml(
          "Quiz",
          `
        <section class="hero">
          <h1>미니 퀴즈 챌린지</h1>
          <p>선택지를 눌러 점수를 모아보세요.</p>
        </section>
        <div class="banner">
          <h2>퀴즈 힌트</h2>
          <p>설명을 잘 읽고 선택해 보세요.</p>
        </div>
      `
        ),
        contentType: "text/html",
      },
      {
        filename: "style.css",
        content: baseStyles,
        contentType: "text/css",
      },
      {
        filename: "script.js",
        content: "",
        contentType: "text/javascript",
      },
    ],
  },
  {
    id: 4,
    title: "4교시 · 작품 전시 페이지",
    goal: "우리의 결과물을 갤러리로 전시해요.",
    description: "카드 그리드와 대표 작품 영역을 준비해요.",
    starterPromptSuggestions: [
      "작품 카드 6개 + 대표 작품 영역을 포함해줘",
      "링크 자리 라벨이 있는 갤러리를 만들어줘",
      "전시 제목/태그라인/대표 작품 카드가 있는 페이지를 만들어줘",
      "깨끗하고 밝은 갤러리 스타일로 만들어줘",
    ],
    requiredFiles: [
      {
        filename: "index.html",
        content: buildHtml(
          "Gallery",
          `
        <section class="hero">
          <h1>작품 전시 갤러리</h1>
          <p>우리의 프로젝트를 카드로 정리해요.</p>
        </section>
        <div class="banner">
          <h2>대표 작품</h2>
          <p>가장 자신 있는 결과물을 이곳에 소개해요.</p>
        </div>
      `
        ),
        contentType: "text/html",
      },
      {
        filename: "style.css",
        content: baseStyles,
        contentType: "text/css",
      },
      {
        filename: "script.js",
        content: "",
        contentType: "text/javascript",
      },
    ],
  },
];

export const getLessonPreset = (lessonId: number) =>
  LESSON_PRESETS.find((lesson) => lesson.id === lessonId);

export const getLessonTemplateFiles = (lessonId: number, templateKey?: string | null) => {
  const preset = getLessonPreset(lessonId);
  if (!preset) {
    return [];
  }

  if (!templateKey) {
    return preset.requiredFiles;
  }

  const mappedLessonId = TEMPLATE_KEY_TO_LESSON_ID[templateKey as EduTemplateKey];
  if (mappedLessonId && mappedLessonId !== preset.id) {
    const mappedPreset = getLessonPreset(mappedLessonId);
    return mappedPreset?.requiredFiles ?? preset.requiredFiles;
  }

  return preset.requiredFiles;
};
