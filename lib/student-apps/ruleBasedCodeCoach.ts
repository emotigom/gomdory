export type CodeCoachLevel = "pass" | "warn" | "challenge";

export type CodeCoachItem = {
  level: CodeCoachLevel;
  title: string;
  message: string;
  hint?: string;
};

type CodeCoachInput = {
  lessonKitId?: string;
  html: string;
  css: string;
  js: string;
};

const hasText = (value: string) => value.trim().length > 0;
const hasPattern = (value: string, pattern: RegExp) => pattern.test(value);
const hasAnyPattern = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

function item(level: CodeCoachLevel, title: string, message: string, hint?: string): CodeCoachItem {
  return hint ? { level, title, message, hint } : { level, title, message };
}

function checkRequiredText(items: CodeCoachItem[], fileName: string, value: string) {
  items.push(
    hasText(value)
      ? item("pass", `${fileName} 확인`, `${fileName} 내용이 들어 있어요.`)
      : item("warn", `${fileName} 살펴보기`, `${fileName}에 아직 내용이 비어 있어요. 짧게라도 작성해 보세요.`),
  );
}

function checkSlot(items: CodeCoachItem[], combined: string, slot: string, title: string) {
  const escaped = slot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`data-slot=["']${escaped}["']|\\b${escaped}\\b`, "i");
  items.push(
    pattern.test(combined)
      ? item("pass", title, `${slot} 부분을 찾았어요.`)
      : item("warn", title, `${slot} 부분을 한 번 확인해 주세요.`, "템플릿의 data-slot 이름을 남겨 두면 점검하기 쉬워요."),
  );
}

function checkCssVariable(items: CodeCoachItem[], css: string, variableName: string) {
  const pattern = new RegExp(`${variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i");
  items.push(
    pattern.test(css)
      ? item("pass", `${variableName} 확인`, `${variableName} 값을 찾았어요.`)
      : item("warn", `${variableName} 살펴보기`, `${variableName} CSS 변수를 확인해 주세요.`),
  );
}

function checkJsPattern(items: CodeCoachItem[], js: string, pattern: RegExp, title: string, message: string, hint?: string) {
  items.push(pattern.test(js) ? item("pass", title, message) : item("warn", title, `${message} 다시 살펴봐요.`, hint));
}

function addCommonChecks(items: CodeCoachItem[], input: CodeCoachInput) {
  const combined = `${input.html}\n${input.css}\n${input.js}`;

  checkRequiredText(items, "index.html", input.html);
  checkRequiredText(items, "style.css", input.css);
  checkRequiredText(items, "script.js", input.js);

  if (hasAnyPattern(combined, [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, /(?:\+?82[-.\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/])) {
    items.push(
      item("warn", "개인정보 살펴보기", "이메일이나 전화번호처럼 보일 수 있는 내용이 있어요.", "실명 연락처 대신 별명이나 가짜 예시를 써도 좋아요."),
    );
  } else {
    items.push(item("pass", "개인정보 확인", "이메일이나 전화번호처럼 보이는 내용은 찾지 못했어요."));
  }

  if (hasAnyPattern(combined, [/\b주소\b|\b학교\b|\b반\b|\b실명\b|\b이름\b/])) {
    items.push(
      item("warn", "개인정보 단어 살펴보기", "주소, 학교, 반, 실명 같은 단어가 있으면 공개해도 괜찮은지 확인해 주세요."),
    );
  }

  if (
    hasAnyPattern(combined, [
      /<script\b[^>]*\bsrc=["']https?:\/\//i,
      /<link\b[^>]*\bhref=["']https?:\/\//i,
      /XMLHttpRequest|navigator\.sendBeacon|window\.open\s*\(|location\.href\s*=\s*["']https?:\/\//i,
    ])
  ) {
    items.push(item("warn", "외부 호출 살펴보기", "외부 주소를 불러오는 코드가 있는지 확인해 주세요."));
  } else {
    items.push(item("pass", "외부 호출 확인", "외부 script나 위험해 보이는 외부 호출은 찾지 못했어요."));
  }

  if (hasPattern(combined, /\bfetch\s*\(/)) {
    items.push(item("warn", "fetch 살펴보기", "현재 수업에서는 외부 API 호출을 사용하지 않아요."));
  }

  items.push(item("challenge", "도전 미션", "미리보기에서 한 번 눌러보고 제출해요."));
}

function addLesson05Checks(items: CodeCoachItem[], input: CodeCoachInput) {
  const combined = `${input.html}\n${input.js}`;
  checkSlot(items, combined, "p5.title", "제목 확인");
  checkSlot(items, combined, "p5.lead", "소개 문장 확인");
  checkSlot(items, combined, "p5.profile.name", "프로필 이름 확인");
  checkSlot(items, combined, "p5.cards.1.body", "첫 번째 카드 확인");
  checkSlot(items, combined, "p5.footer", "푸터 확인");
  checkSlot(items, combined, "p5.button", "버튼 문구 확인");
  items.push(item("challenge", "도전 미션", "빠르게 끝났다면 카드 3개를 모두 자기 말로 바꿔 보세요."));
}

function addLesson06Checks(items: CodeCoachItem[], input: CodeCoachInput) {
  for (const variableName of ["--accent", "--bg", "--card", "--radius", "--title-size", "--button-bg"]) {
    checkCssVariable(items, input.css, variableName);
  }
  items.push(item("challenge", "도전 미션", "빠르게 끝났다면 테마 이름을 붙이고 글자와 배경의 색상 대비를 확인해 보세요."));
}

function addLesson07Checks(items: CodeCoachItem[], input: CodeCoachInput) {
  checkJsPattern(items, input.js, /\baddEventListener\s*\(/, "클릭 연결 확인", "버튼 반응을 연결하는 addEventListener가 보여요.");
  checkJsPattern(items, input.js, /\bquerySelector\s*\(/, "요소 찾기 확인", "querySelector로 화면 요소를 찾고 있어요.");
  checkJsPattern(items, input.js, /\b(?:let|const|var)\s+count\b|\bcount\s*[=+]/, "count 변수 확인", "count 변수를 사용하고 있어요.");
  checkJsPattern(items, input.js, /\bclassList\b/, "classList 확인", "classList로 화면 상태를 바꾸고 있어요.");
  checkJsPattern(items, input.js, /reset/i, "reset 버튼 확인", "reset 버튼 관련 코드를 찾았어요.");
  checkJsPattern(
    items,
    input.js,
    /mood|focus|challenge|rest/i,
    "상태 문구 확인",
    "mood, focus, challenge, rest 관련 코드를 찾았어요.",
  );

  for (const [apiName, pattern] of [
    ["fetch", /\bfetch\s*\(/],
    ["localStorage", /\blocalStorage\b/],
    ["eval", /\beval\s*\(/],
  ] as const) {
    if (pattern.test(input.js)) {
      items.push(item("warn", `${apiName} 살펴보기`, `이번 상호작용 수업에서는 ${apiName} 없이 버튼 반응을 만들어 봐요.`));
    } else {
      items.push(item("pass", `${apiName} 확인`, `${apiName} 사용은 찾지 못했어요.`));
    }
  }

  items.push(item("challenge", "도전 미션", "빠르게 끝났다면 5회 이상 클릭했을 때 나오는 보너스 메시지를 자기 말로 바꿔 보세요."));
}

function addLesson12Checks(items: CodeCoachItem[], input: CodeCoachInput) {
  const combined = `${input.html}\n${input.css}\n${input.js}`;

  checkJsPattern(items, input.js, /const\s+quizConfig\s*=/, "quizConfig 확인", "퀴즈 데이터 상자를 찾았어요.");
  checkJsPattern(items, input.js, /questions\s*:\s*\[/, "questions 배열 확인", "문제 목록 배열을 찾았어요.");
  checkJsPattern(items, input.js, /answerIndex\s*:/, "정답 번호 확인", "정답 번호 answerIndex를 찾았어요.");
  checkJsPattern(items, input.js, /hint\s*:/, "힌트 확인", "힌트 문장을 찾았어요.");
  checkJsPattern(items, input.js, /feedback\s*:/, "피드백 확인", "피드백 문장을 찾았어요.");
  checkJsPattern(items, input.js, /createElement\("button"\)|addEventListener\("click"/, "선택지 버튼 확인", "선택지 버튼을 만드는 코드를 찾았어요.");

  const questionCount = (input.js.match(/question\s*:/g) ?? []).length;
  items.push(
    questionCount >= 3
      ? item("pass", "문제 3개 확인", "도전 미션처럼 문제를 3개 이상 준비했어요.")
      : item("challenge", "문제 늘리기", "문제를 3개 이상으로 늘리면 도전 미션을 달성할 수 있어요."),
  );

  if (hasAnyPattern(combined, [/https?:\/\//i, /\bfetch\s*\(/, /XMLHttpRequest|navigator\.sendBeacon/i])) {
    items.push(item("warn", "외부 호출 살펴보기", "이번 퀴즈 앱은 로컬 배열과 객체만 사용해야 해요."));
  } else {
    items.push(item("pass", "로컬 데이터 확인", "외부 호출 없이 로컬 데이터로 퀴즈를 만들고 있어요."));
  }

  items.push(item("challenge", "보스 미션", "점수 등급, 만점 메시지, 자동 힌트, 랜덤 문제 순서 중 하나를 골라 추가해 보세요."));
}

export function runRuleBasedCodeCoach(input: CodeCoachInput): CodeCoachItem[] {
  const items: CodeCoachItem[] = [];
  addCommonChecks(items, input);

  if (input.lessonKitId === "lesson-05-html-structure") {
    addLesson05Checks(items, input);
  } else if (input.lessonKitId === "lesson-06-css-styling") {
    addLesson06Checks(items, input);
  } else if (input.lessonKitId === "lesson-07-js-interaction") {
    addLesson07Checks(items, input);
  } else if (input.lessonKitId === "lesson-12-ai-quiz-maker") {
    addLesson12Checks(items, input);
  }

  return items;
}
