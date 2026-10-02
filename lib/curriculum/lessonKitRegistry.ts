export type LessonKitAudience = "teacher" | "student";
export type LessonKitPhase = "prototype";
export type LessonKitFormat = "static-html";

export type LessonKitDocsPaths = {
  readonly teacherHtmlPath: string;
  readonly studentHtmlPath: string;
  readonly sampleDirPath: string;
};

export type LessonKitPublicAssets = {
  readonly teacherHtmlUrl: string;
  readonly studentHtmlUrl: string;
  readonly sampleIndexUrl: string;
  readonly sampleAssetUrls: readonly string[];
};

export type LessonKitSampleUrls = {
  readonly indexHtmlUrl: string;
  readonly styleCssUrl: string;
  readonly scriptJsUrl: string;
};

export type LessonKitStudentPreviewAction = {
  readonly label: string;
  readonly description: string;
  readonly note: string;
  readonly href: string;
};

export type LessonKitDownloadFile = {
  readonly path: string;
  readonly label: string;
  readonly url: string;
  readonly codeView?: "html" | "css" | "js";
};

export type LessonKitStudentDownloads = {
  readonly zipUrl?: string;
  readonly zipLabel?: string;
  readonly files: readonly LessonKitDownloadFile[];
};

export type LessonKitStudentCard = {
  readonly displayTitle?: string;
  readonly tasks:
    | readonly [string, string, string]
    | readonly [string, string, string, string]
    | readonly [string, string, string, string, string];
  readonly saveLocation: string;
};

export type LessonKitRegistryEntry = {
  readonly lessonId: string;
  readonly title: string;
  readonly description: string;
  readonly audience: readonly LessonKitAudience[];
  readonly phase: LessonKitPhase;
  readonly format: LessonKitFormat;
  readonly docs: LessonKitDocsPaths;
  readonly public: LessonKitPublicAssets;
  readonly studentPreviewAction?: LessonKitStudentPreviewAction;
  readonly studentDownloads?: LessonKitStudentDownloads;
  readonly studentCard?: LessonKitStudentCard;
  readonly supportedStudentAppLevel: readonly string[];
  readonly unsupported: readonly string[];
  readonly safety: readonly string[];
};

export const HTML_LESSON_KIT_REGISTRY = [
  {
    lessonId: "lesson-05-html-structure",
    title: "5차시 HTML 구조 이해",
    description:
      "HTML 글자를 바꾸며 나를 소개하는 첫 예제 페이지를 완성하는 수업 안내입니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-05-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-05-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-05-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-05-html-structure/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-05-html-structure/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-05-html-structure/sample/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-05-html-structure/sample/style.css",
        "/lesson-kits/html/lesson-05-html-structure/sample/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
    ],
    safety: [
      "Do not include personal information.",
      "Teacher manages whether student submissions are published.",
      "Explain localStorage only as browser-local storage.",
    ],
  },
  {
    lessonId: "lesson-06-css-styling",
    title: "6차시 CSS로 화면 꾸미기",
    description:
      "CSS 변수로 색, 글자 크기, 카드 분위기를 바꾸는 예제 페이지 수업 안내입니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-06-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-06-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-06-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-06-css-styling/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-06-css-styling/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-06-css-styling/sample/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-06-css-styling/sample/style.css",
        "/lesson-kits/html/lesson-06-css-styling/sample/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js 자동 빌드",
      "SSR/API route",
      "외부 DB",
      "Supabase/API secret",
    ],
    safety: [
      "개인정보를 넣지 않습니다.",
      "제출과 검토는 기존 Gomdory 학생 앱 제출 흐름에서 진행합니다.",
      "학생 체크리스트는 브라우저 localStorage에만 저장됩니다.",
    ],
  },
  {
    lessonId: "lesson-07-js-interaction",
    title: "7차시 JavaScript 버튼 응원함",
    description:
      "JavaScript 버튼, 카운터, 리셋, 상태 변화를 미리보기로 확인하는 수업 안내입니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-07-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-07-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-07-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-07-js-interaction/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-07-js-interaction/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-07-js-interaction/sample/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-07-js-interaction/sample/style.css",
        "/lesson-kits/html/lesson-07-js-interaction/sample/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
    ],
    safety: [
      "개인정보를 넣지 않습니다.",
      "공개 여부와 갤러리 관리는 선생님이 관리합니다.",
      "학생 체크리스트는 브라우저 localStorage에만 저장됩니다.",
    ],
  },
  {
    lessonId: "lesson-08-web-core-basics",
    title: "8차시 HTML/CSS/JS 핵심 보충",
    description:
      "HTML은 구조, CSS는 꾸미기, JavaScript는 움직임을 맡는다는 것을 확인하고 접근성 이름표인 aria-label을 이해합니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-08-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-08-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-08-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-08-web-core-basics/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-08-web-core-basics/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-08-web-core-basics/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-08-web-core-basics/style.css",
        "/lesson-kits/html/lesson-08-web-core-basics/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
    ],
    safety: [
      "Do not include personal information.",
      "Teacher manages whether student submissions are published.",
      "Use aria-label only as a short accessibility label.",
    ],
  },
  {
    lessonId: "lesson-09-vscode-file-structure",
    title: "9차시 VS Code와 파일 구조",
    description:
      "Gomdory에서 만든 웹앱이 index.html, style.css, script.js 세 파일로 이루어져 있음을 확인하고 VS Code는 가볍게 맛봅니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-09-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-09-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-09-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-09-vscode-file-structure/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-09-vscode-file-structure/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-09-vscode-file-structure/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-09-vscode-file-structure/style.css",
        "/lesson-kits/html/lesson-09-vscode-file-structure/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
    ],
    safety: [
      "Do not include personal information.",
      "Teacher manages whether student submissions are published.",
      "VS Code installation is optional; students can continue in Gomdory.",
    ],
  },
  {
    lessonId: "lesson-10-js-reaction-lab",
    title: "10차시 보충 JavaScript 반응 복습",
    description:
      "빠른 학생용 추가 미션으로 버튼 클릭, 문장, 이모지, 색상, 클릭 횟수 반응을 복습합니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-10-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-10-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-10-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-10-js-reaction-lab/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-10-js-reaction-lab/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-10-js-reaction-lab/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-10-js-reaction-lab/style.css",
        "/lesson-kits/html/lesson-10-js-reaction-lab/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
    ],
    safety: [
      "Do not include personal information.",
      "Teacher manages whether student submissions are published.",
      "Use JavaScript only for browser-local screen reactions.",
    ],
  },
  {
    lessonId: "lesson-10-ai-favorite-page",
    title: "10차시 AI와 함께 만드는 주제 소개 페이지",
    description:
      "AI 초안 예시를 참고하되 학생이 직접 고르고 고쳐서 좋아하는 안전한 주제 소개 페이지를 완성합니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-10-ai-favorite-page-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-10-ai-favorite-page-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-10-ai-favorite-page-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-10-ai-favorite-page/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-10-ai-favorite-page/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-10-ai-favorite-page/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-10-ai-favorite-page/style.css",
        "/lesson-kits/html/lesson-10-ai-favorite-page/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
    ],
    safety: [
      "실명 친구, 학교 친구, 선생님 개인정보 소개 페이지는 만들지 않습니다.",
      "실명, 학교, 반, 전화번호, 주소는 쓰지 않습니다.",
      "공개 인물, 캐릭터, 동물, 취미, 장소, 게임, 음악처럼 안전한 주제를 고릅니다.",
      "AI는 초안을 도와줄 수 있지만, 최종 선택과 수정은 내가 합니다.",
    ],
  },
  {
    lessonId: "lesson-11-ai-3d-mission-room",
    title: "11차시 AI 3D 미션룸 만들기",
    description:
      "three.js 기반 3D 미션룸의 제목, 색상, 방 이름, 힌트, 성공 문장을 바꾸며 AI처럼 보이는 규칙 프로그램을 이해합니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-11-ai-3d-mission-room-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-11-ai-3d-mission-room-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-11-ai-3d-mission-room-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-11-ai-3d-mission-room/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-11-ai-3d-mission-room/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-11-ai-3d-mission-room/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-11-ai-3d-mission-room/style.css",
        "/lesson-kits/html/lesson-11-ai-3d-mission-room/script.js",
      ],
    },
    studentPreviewAction: {
      label: "3D 크게 보기",
      description: "큰 화면으로 기본 3D 미션룸을 확인해요. 내 수정 내용은 코딩 화면 미리보기와 제출물에서 확인해요.",
      note: "3D 크게 보기는 기본 예제 화면이에요. 내 수정 내용은 코딩 화면 미리보기와 제출물에서 확인해요.",
      href: "/lesson-kits/html/lesson-11-ai-3d-mission-room/index.html?mode=play",
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
      "WebLLM",
      "External AI API",
    ],
    safety: [
      "이 앱은 진짜 AI가 판단하는 것이 아니라 규칙에 따라 힌트를 보여줍니다.",
      "AI처럼 보이는 프로그램과 진짜 AI의 차이를 설명합니다.",
      "외부 AI API, API key, WebLLM을 사용하지 않습니다.",
      "3D 로딩 실패 시 fallback 안내로 수업을 계속합니다.",
    ],
  },
  {
    lessonId: "lesson-13-ai-camera-card",
    title: "13차시 카메라 인식과 AI 포토 카드",
    description:
      "기존 Award VR 체험을 활용해 나만의 AI 포토 카드를 만들고, 카메라와 얼굴 정보 사용에서 동의와 개인정보 보호를 함께 배웁니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-13-ai-camera-card-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-13-ai-camera-card-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-13-ai-camera-card-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-13-ai-camera-card/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-13-ai-camera-card/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-13-ai-camera-card/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-13-ai-camera-card/style.css",
        "/lesson-kits/html/lesson-13-ai-camera-card/script.js",
      ],
    },
    studentPreviewAction: {
      label: "AI 포토 카드 체험 열기",
      description:
        "새 창에서 Award VR 체험을 열고 카메라 권한과 개인정보 안전 안내를 확인해요.",
      note: "카메라 권한은 직접 선택합니다. 불편하면 카메라를 사용하지 않고 예시 화면만 보아도 됩니다.",
      href: "/events/teacher-day/award-vr-lab",
    },
    studentDownloads: {
      zipUrl: "/lesson-kits/downloads/lesson-13-ai-photo-card-starter.zip",
      zipLabel: "전체 ZIP 다운로드",
      files: [
        {
          path: "index.html",
          label: "index.html",
          url: "/lesson-kits/html/lesson-13-ai-photo-card-starter/index.html",
          codeView: "html",
        },
        {
          path: "style.css",
          label: "style.css",
          url: "/lesson-kits/html/lesson-13-ai-photo-card-starter/style.css",
          codeView: "css",
        },
        {
          path: "app.js",
          label: "app.js",
          url: "/lesson-kits/html/lesson-13-ai-photo-card-starter/app.js",
          codeView: "js",
        },
        {
          path: "assets/stage-camera-ring-textless.png",
          label: "stage-camera-ring-textless.png",
          url: "/lesson-kits/html/lesson-13-ai-photo-card-starter/assets/stage-camera-ring-textless.png",
        },
        {
          path: "assets/stage-ceremony-textless.png",
          label: "stage-ceremony-textless.png",
          url: "/lesson-kits/html/lesson-13-ai-photo-card-starter/assets/stage-ceremony-textless.png",
        },
        {
          path: "assets/trophy-textless.png",
          label: "trophy-textless.png",
          url: "/lesson-kits/html/lesson-13-ai-photo-card-starter/assets/trophy-textless.png",
        },
      ],
    },
    studentCard: {
      tasks: [
        "ZIP 파일을 내려받아 압축을 풀기",
        "index.html을 열어 시작 화면 확인하기",
        "카메라 사용 여부를 직접 선택하고 AI 포토 카드 꾸미기",
        "완성한 결과를 확인하고 수업 보드에 제출하기",
      ],
      saveLocation: "내 컴퓨터의 lesson-13-ai-photo-card-starter 폴더에 저장하세요.",
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
      "WebLLM",
      "External AI API",
      "API key",
      "Camera processing changes",
    ],
    safety: [
      "친구의 얼굴이나 사진은 허락 없이 사용하지 않습니다.",
      "이름, 학교, 전화번호, 주소 같은 개인정보를 넣지 않습니다.",
      "불편하면 카메라를 사용하지 않고 예시 화면만 보아도 됩니다.",
      "외부 AI API, API key, WebLLM을 사용하지 않습니다.",
      "기존 Award VR 체험 로직은 변경하지 않습니다.",
    ],
  },
  {
    lessonId: "lesson-12-ai-quiz-maker",
    title: "12차시 AI 문제 만들기와 미니 퀴즈 게임",
    description:
      "AI가 만든 것처럼 보이는 문제 예시를 사람이 검토하고, 로컬 JavaScript 배열/객체를 수정해 친구가 풀 수 있는 미니 퀴즈 앱을 완성합니다.",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "docs/curriculum/html-lessons/lesson-12-ai-quiz-maker-teacher.html",
      studentHtmlPath: "docs/curriculum/html-lessons/lesson-12-ai-quiz-maker-student.html",
      sampleDirPath: "docs/curriculum/html-lessons/lesson-12-ai-quiz-maker-sample",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-12-ai-quiz-maker/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-12-ai-quiz-maker/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-12-ai-quiz-maker/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-12-ai-quiz-maker/style.css",
        "/lesson-kits/html/lesson-12-ai-quiz-maker/script.js",
      ],
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
      "WebLLM",
      "External AI API",
      "API key",
    ],
    safety: [
      "문제와 정답에 이름, 학교, 전화번호, 주소 같은 개인정보를 넣지 않습니다.",
      "미니 퀴즈 게임은 브라우저 안의 로컬 JavaScript 데이터만 사용합니다.",
      "외부 AI API, API key, WebLLM을 사용하지 않습니다.",
    ],
  },
  {
    lessonId: "lesson-14-ai-portfolio-starter",
    title: "AI 작품 갤러리 스타터 키트",
    description:
      "Canva로 만든 만화 카드나 여러 장짜리 그림 이야기를 작품 갤러리에 저장하는 수업자료",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "public/lesson-kits/html/lesson-14-ai-portfolio-starter/teacher.html",
      studentHtmlPath: "public/lesson-kits/html/lesson-14-ai-portfolio-starter/student.html",
      sampleDirPath: "public/lesson-kits/html/lesson-14-ai-portfolio-starter",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-14-ai-portfolio-starter/teacher.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-14-ai-portfolio-starter/student.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-14-ai-portfolio-starter/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-14-ai-portfolio-starter/style.css",
        "/lesson-kits/html/lesson-14-ai-portfolio-starter/script.js",
      ],
    },
    studentDownloads: {
      zipUrl: "/lesson-kits/downloads/lesson-14-ai-portfolio-starter.zip",
      zipLabel: "전체 ZIP 다운로드",
      files: [
        {
          path: "index.html",
          label: "index.html",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/index.html",
          codeView: "html",
        },
        {
          path: "style.css",
          label: "style.css",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/style.css",
          codeView: "css",
        },
        {
          path: "script.js",
          label: "script.js",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/script.js",
          codeView: "js",
        },
        {
          path: "comic-board.html",
          label: "comic-board.html",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/comic-board.html",
          codeView: "html",
        },
        {
          path: "comic-board.css",
          label: "comic-board.css",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/comic-board.css",
          codeView: "css",
        },
        {
          path: "comic-board.js",
          label: "comic-board.js",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/comic-board.js",
          codeView: "js",
        },
        {
          path: "picture-book.html",
          label: "picture-book.html",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/picture-book.html",
          codeView: "html",
        },
        {
          path: "picture-book.css",
          label: "picture-book.css",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/picture-book.css",
          codeView: "css",
        },
        {
          path: "picture-book.js",
          label: "picture-book.js",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/picture-book.js",
          codeView: "js",
        },
        {
          path: "README.md",
          label: "README.md",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/README.md",
        },
        {
          path: "notes/01_comic_description.txt",
          label: "01_comic_description.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/01_comic_description.txt",
        },
        {
          path: "notes/02_music_description.txt",
          label: "02_music_description.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/02_music_description.txt",
        },
        {
          path: "notes/03_video_description.txt",
          label: "03_video_description.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/03_video_description.txt",
        },
        {
          path: "notes/portfolio_prompt.txt",
          label: "portfolio_prompt.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/portfolio_prompt.txt",
        },
        {
          path: "notes/persona_template.txt",
          label: "persona_template.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/persona_template.txt",
        },
        {
          path: "notes/storyboard_template.txt",
          label: "storyboard_template.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/storyboard_template.txt",
        },
        {
          path: "notes/prompt_log.txt",
          label: "prompt_log.txt",
          url: "/lesson-kits/html/lesson-14-ai-portfolio-starter/notes/prompt_log.txt",
        },
      ],
    },
    studentCard: {
      displayTitle: "AI 작품 갤러리 스타터 키트",
      tasks: [
        "ZIP 파일을 내려받아 압축을 풀기",
        "Canva로 만든 여러 장짜리 그림 이야기는 picture-book.html을 열기",
        "Canva로 만든 만화 카드나 직접 장면을 만들 때는 comic-board.html을 열기",
        "작품 갤러리의 설명과 대표 이미지를 내 작품 내용으로 바꾸기",
        "완성한 파일을 저장하고 수업 보드에 제출하기",
      ],
      saveLocation: "내 컴퓨터의 lesson-14-ai-portfolio-starter 폴더에 저장하세요.",
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
      "WebLLM",
      "External AI API",
      "API key",
    ],
    safety: [
      "작품 설명과 작품 갤러리에 이름, 학교, 전화번호, 주소 같은 개인정보를 넣지 않습니다.",
      "친구의 작품은 허락 없이 작품 갤러리에 사용하지 않습니다.",
      "외부 AI API, API key, WebLLM을 사용하지 않습니다.",
    ],
  },
  {
    lessonId: "lesson-15-ai-gallery-site-starter",
    title: "AI 작품 모음집 사이트 스타터 키트",
    description:
      "친구들이 만든 이미지, 영상, 음악, 외부 링크 작품을 한곳에 모아 전시하는 HTML/CSS/JavaScript 갤러리 수업자료",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "public/lesson-kits/html/lesson-15-ai-gallery-site-starter/index.html",
      studentHtmlPath: "public/lesson-kits/html/lesson-15-ai-gallery-site-starter/index.html",
      sampleDirPath: "public/lesson-kits/html/lesson-15-ai-gallery-site-starter",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/index.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/index.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-15-ai-gallery-site-starter/styles.css",
        "/lesson-kits/html/lesson-15-ai-gallery-site-starter/script.js",
        "/lesson-kits/html/lesson-15-ai-gallery-site-starter/works.sample.json",
        "/lesson-kits/html/lesson-15-ai-gallery-site-starter/deploy-guide.html",
        "/lesson-kits/html/lesson-15-ai-gallery-site-starter/teacher-runbook.html",
      ],
    },
    studentDownloads: {
      zipUrl: "/lesson-kits/downloads/lesson-15-ai-gallery-site-starter.zip",
      zipLabel: "전체 ZIP 다운로드",
      files: [
        {
          path: "index.html",
          label: "index.html",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/index.html",
          codeView: "html",
        },
        {
          path: "styles.css",
          label: "styles.css",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/styles.css",
          codeView: "css",
        },
        {
          path: "script.js",
          label: "script.js",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/script.js",
          codeView: "js",
        },
        {
          path: "works.sample.json",
          label: "works.sample.json",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/works.sample.json",
        },
        {
          path: "README.md",
          label: "README.md",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/README.md",
        },
        {
          path: "deploy-guide.html",
          label: "deploy-guide.html",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/deploy-guide.html",
        },
        {
          path: "teacher-runbook.html",
          label: "teacher-runbook.html",
          url: "/lesson-kits/html/lesson-15-ai-gallery-site-starter/teacher-runbook.html",
        },
      ],
    },
    studentCard: {
      displayTitle: "AI 작품 모음집 사이트 스타터 키트",
      tasks: [
        "ZIP 파일을 내려받아 압축을 풀기",
        "index.html을 열어 샘플 갤러리 확인하기",
        "교사 화면의 모음집 데이터 JSON을 script.js의 works 배열에 붙여넣기",
        "개인정보와 저작권 안전 점검 후 전시용 파일로 저장하기",
      ],
      saveLocation: "내 컴퓨터의 lesson-15-ai-gallery-site-starter 폴더에 저장하세요.",
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Vite/React/Next.js automatic build",
      "SSR/API route",
      "External database",
      "Supabase/API secret",
      "WebLLM",
      "External AI API",
      "API key",
      "External deployment API",
      "iframe embedding for external links",
    ],
    safety: [
      "작품 데이터에 실명, 학교, 반, 연락처 같은 개인정보를 넣지 않습니다.",
      "얼굴 사진과 허락받지 않은 친구 작품은 공개 전 제거합니다.",
      "유명 캐릭터를 그대로 사용한 작품은 공개 전 수정합니다.",
      "외부 링크와 HTML 작품은 iframe이 아니라 새 탭 링크로 엽니다.",
    ],
  },
  {
    lessonId: "lesson-16-clipchamp-ai-trailer",
    title: "Clipchamp AI 작품 예고편 만들기",
    description:
      "내가 만든 AI 이미지와 이야기를 20~40초 영상 예고편으로 편집하고 video.mp4로 제출하는 수업자료",
    audience: ["teacher", "student"],
    phase: "prototype",
    format: "static-html",
    docs: {
      teacherHtmlPath: "public/lesson-kits/html/lesson-16-clipchamp-ai-trailer/index.html",
      studentHtmlPath: "public/lesson-kits/html/lesson-16-clipchamp-ai-trailer/index.html",
      sampleDirPath: "public/lesson-kits/html/lesson-16-clipchamp-ai-trailer",
    },
    public: {
      teacherHtmlUrl: "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/index.html",
      studentHtmlUrl: "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/index.html",
      sampleIndexUrl: "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/index.html",
      sampleAssetUrls: [
        "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/style.css",
        "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/README.md",
      ],
    },
    studentDownloads: {
      zipUrl: "/lesson-kits/downloads/lesson-16-clipchamp-ai-trailer.zip",
      zipLabel: "전체 ZIP 다운로드",
      files: [
        {
          path: "index.html",
          label: "index.html",
          url: "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/index.html",
          codeView: "html",
        },
        {
          path: "style.css",
          label: "style.css",
          url: "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/style.css",
          codeView: "css",
        },
        {
          path: "README.md",
          label: "README.md",
          url: "/lesson-kits/html/lesson-16-clipchamp-ai-trailer/README.md",
        },
      ],
    },
    studentCard: {
      displayTitle: "Clipchamp AI 작품 예고편 만들기",
      tasks: [
        "AI 작품 이미지 3~5장과 작품 제목 준비하기",
        "자막 문장 3개를 쓰고 장면 순서를 정하기",
        "Clipchamp에서 20~40초 예고편 영상으로 편집하기",
        "mp4로 내보내고 파일명을 video.mp4로 저장하기",
        "Gomdory 작품 카드에 video.mp4와 소개 문장을 제출하기",
      ],
      saveLocation: "내 컴퓨터에 video.mp4로 저장한 뒤 Gomdory 작품 카드에 첨부하세요.",
    },
    supportedStudentAppLevel: ["Level 1 HTML/CSS/JS", "Level 1.5 ZIP static site"],
    unsupported: [
      "Clipchamp API integration",
      "Microsoft account integration",
      "External service auto-login",
      "External service auto-upload",
      "Database/API changes",
      "Student card CRUD changes",
      "Automatic file drop submission",
    ],
    safety: [
      "영상과 자막에 실명, 학교명, 연락처 같은 개인정보를 넣지 않습니다.",
      "얼굴 사진을 넣지 않습니다.",
      "음악 소리가 너무 크지 않게 하고 글자가 배경에 묻히지 않게 합니다.",
      "최종 파일은 video.mp4로 저장합니다.",
    ],
  },
] as const satisfies readonly LessonKitRegistryEntry[];

export function getHtmlLessonKitById(lessonId: string): LessonKitRegistryEntry | undefined {
  return HTML_LESSON_KIT_REGISTRY.find((lessonKit) => lessonKit.lessonId === lessonId);
}

export function getLessonKitSampleUrls(lessonId: string): LessonKitSampleUrls | undefined {
  const lessonKit = getHtmlLessonKitById(lessonId);
  if (!lessonKit) return undefined;

  const styleCssUrl = lessonKit.public.sampleAssetUrls.find((url) => /\/styles?\.css$/.test(url));
  const scriptJsUrl = lessonKit.public.sampleAssetUrls.find((url) => url.endsWith("/script.js"));
  if (!styleCssUrl || !scriptJsUrl) return undefined;

  return {
    indexHtmlUrl: lessonKit.public.sampleIndexUrl,
    styleCssUrl,
    scriptJsUrl,
  };
}

export function getLessonKitStudentDownloads(lessonId: string): LessonKitStudentDownloads | undefined {
  const lessonKit = getHtmlLessonKitById(lessonId);
  if (!lessonKit) return undefined;
  if (lessonKit.studentDownloads) return lessonKit.studentDownloads;

  const sampleUrls = getLessonKitSampleUrls(lessonId);
  if (!sampleUrls) return undefined;

  return {
    files: [
      {
        path: "index.html",
        label: "index.html",
        url: sampleUrls.indexHtmlUrl,
        codeView: "html",
      },
      {
        path: "style.css",
        label: "style.css",
        url: sampleUrls.styleCssUrl,
        codeView: "css",
      },
      {
        path: "script.js",
        label: "script.js",
        url: sampleUrls.scriptJsUrl,
        codeView: "js",
      },
    ],
  };
}
