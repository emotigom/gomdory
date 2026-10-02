import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runRuleBasedCodeCoach } from "@/lib/student-apps/ruleBasedCodeCoach";

const baseInput = {
  html: '<main data-slot="p5.title">Hello</main>',
  css: ":root { --accent: #0ea5e9; --bg: #ffffff; --card: #f8fafc; --radius: 12px; --title-size: 32px; --button-bg: #2563eb; }",
  js: "let count = 0; document.querySelector('#go')?.addEventListener('click', () => document.body.classList.toggle('focus')); function reset() { count = 0; } const mood = 'challenge rest';",
};

test("rule based coach checks common empty HTML CSS JS content", () => {
  const items = runRuleBasedCodeCoach({ html: "", css: "", js: "" });

  assert.equal(items.filter((item) => item.level === "warn").some((item) => item.title === "index.html 살펴보기"), true);
  assert.equal(items.filter((item) => item.level === "warn").some((item) => item.title === "style.css 살펴보기"), true);
  assert.equal(items.filter((item) => item.level === "warn").some((item) => item.title === "script.js 살펴보기"), true);
});

test("rule based coach warns for suspicious email and phone patterns", () => {
  const items = runRuleBasedCodeCoach({
    html: "<p>hello@example.com 010-1234-5678</p>",
    css: "body { color: black; }",
    js: "console.log('ready');",
  });

  assert.equal(items.some((item) => item.level === "warn" && item.title === "개인정보 살펴보기"), true);
});

test("rule based coach checks lesson 5 p5 data slots", () => {
  const items = runRuleBasedCodeCoach({
    lessonKitId: "lesson-05-html-structure",
    html: [
      '<h1 data-slot="p5.title">Title</h1>',
      '<p data-slot="p5.lead">Lead</p>',
      '<strong data-slot="p5.profile.name">Name</strong>',
      '<p data-slot="p5.cards.1.body">Card</p>',
      '<button data-slot="p5.button">Go</button>',
      '<footer data-slot="p5.footer">Footer</footer>',
    ].join("\n"),
    css: "body { color: black; }",
    js: "console.log('ready');",
  });

  assert.equal(items.some((item) => item.level === "pass" && item.message.includes("p5.title")), true);
  assert.equal(items.some((item) => item.level === "challenge" && item.message.includes("카드 3개")), true);
});

test("rule based coach checks lesson 6 CSS variables", () => {
  const items = runRuleBasedCodeCoach({ ...baseInput, lessonKitId: "lesson-06-css-styling" });

  for (const variableName of ["--accent", "--bg", "--card", "--radius", "--title-size", "--button-bg"]) {
    assert.equal(items.some((item) => item.level === "pass" && item.title === `${variableName} 확인`), true);
  }
});

test("rule based coach checks lesson 7 interaction code", () => {
  const items = runRuleBasedCodeCoach({ ...baseInput, lessonKitId: "lesson-07-js-interaction" });

  for (const title of ["클릭 연결 확인", "요소 찾기 확인", "count 변수 확인", "classList 확인", "reset 버튼 확인", "상태 문구 확인"]) {
    assert.equal(items.some((item) => item.level === "pass" && item.title === title), true, title);
  }
});

test("rule based coach warns for fetch localStorage and eval in lesson 7", () => {
  const items = runRuleBasedCodeCoach({
    ...baseInput,
    lessonKitId: "lesson-07-js-interaction",
    js: `${baseInput.js}\nfetch('/api'); localStorage.setItem('x', 'y'); eval('count = 1');`,
  });

  for (const apiName of ["fetch", "localStorage", "eval"]) {
    assert.equal(items.some((item) => item.level === "warn" && item.title === `${apiName} 살펴보기`), true, apiName);
  }
});

test("rule based coach checks lesson 12 quiz config", () => {
  const items = runRuleBasedCodeCoach({
    lessonKitId: "lesson-12-ai-quiz-maker",
    html: '<main><button id="startButton">Start</button></main>',
    css: ":root { --theme-color: #8b5cf6; } .choice-grid { display: grid; }",
    js: [
      "const quizConfig = {",
      "questions: [",
      "{ question: 'Q1', choices: ['A', 'B', 'C', 'D'], answerIndex: 1, hint: 'H', feedback: 'F' },",
      "{ question: 'Q2', choices: ['A', 'B', 'C', 'D'], answerIndex: 2, hint: 'H', feedback: 'F' },",
      "{ question: 'Q3', choices: ['A', 'B', 'C', 'D'], answerIndex: 3, hint: 'H', feedback: 'F' },",
      "],",
      "};",
      'document.createElement("button");',
      'startButton.addEventListener("click", () => {});',
    ].join("\n"),
  });

  for (const title of ["quizConfig 확인", "questions 배열 확인", "정답 번호 확인", "힌트 확인", "피드백 확인", "선택지 버튼 확인", "문제 3개 확인", "로컬 데이터 확인"]) {
    assert.equal(items.some((item) => item.level === "pass" && item.title === title), true, title);
  }
});

test("rule based coach implementation stays local and avoids WebLLM imports", () => {
  const source = readFileSync("lib/student-apps/ruleBasedCodeCoach.ts", "utf8");

  assert.doesNotMatch(source, /from\s+["']@mlc-ai\/web-llm["']|WebLLM|model loading/i);
  assert.doesNotMatch(source, /await\s+fetch|new\s+XMLHttpRequest|navigator\.sendBeacon\s*\(/);
});
