import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { LESSON_03_04_VIBE_CODING_CONTENT as c } from "@/lib/edu/vibe-coding/lesson-03-04-content";

test("content exports lesson title", () => assert.equal(c.metadata.title, "3/4차시: Gemini로 기획하고 Lovable로 앱 프로토타입 만들기"));
test("content includes lesson03 and lesson04", () => assert.deepEqual(c.lessonPlans.map((x) => x.key), ["lesson03", "lesson04"]));
test("content includes required worksheets", () => {
  const titles = c.worksheets.map((x) => x.title);
  ["앱 아이디어 제출", "AI 프롬프트 제출", "작품 링크 제출", "Canva 시안 제출", "실패 기록 제출", "친구 피드백"].forEach((title) => assert.ok(titles.includes(title)));
});
test("content includes privacy forbidden items", () => ["실명", "전화번호", "주소", "학교명", "얼굴 사진"].forEach((item) => assert.ok(c.safetyChecklist.forbidden.includes(item))));

test("content module includes worksheet, fallback, and teacher script contract", () => {
  const worksheetTitles = c.worksheets.map((x) => x.title);
  ["앱 아이디어 제출", "AI 프롬프트 제출", "작품 링크 제출", "Canva 시안 제출", "실패 기록 제출", "친구 피드백"].forEach((title) => {
    assert.ok(worksheetTitles.includes(title));
  });

  c.fallbackPlan.forEach(([issue, action]) => {
    assert.equal(typeof issue, "string");
    assert.equal(typeof action, "string");
    assert.ok(issue.trim().length > 0);
    assert.ok(action.trim().length > 0);
  });

  const scriptTitles = c.teacherScripts.map((x) => x.title);
  ["3차시 시작", "4차시 중간 제출 안내"].forEach((scriptTitle) => {
    assert.ok(scriptTitles.includes(scriptTitle));
  });
});


test("content includes preflight checklist contract", () => {
  assert.ok(Array.isArray(c.preflightChecklist));
  assert.ok(c.preflightChecklist.length >= 5);
  const flattened = c.preflightChecklist.flatMap((group) => [group.title, ...group.items]).join("\n");
  ["Gemini", "Lovable", "GKrry", "실패 기록"].forEach((keyword) => assert.match(flattened, new RegExp(keyword)));
});

test("lesson page source uses SSOT content module and renders required sections", () => {
  const page = readFileSync(path.join(process.cwd(), "app/edu/vibe-coding/lesson-03-04/page.tsx"), "utf8");

  assert.ok(page.includes('import { LESSON_03_04_VIBE_CODING_CONTENT as content }'));
  assert.ok(page.includes('<Section id="prep" title="교사 준비 체크리스트">'));

  ["수업 목표", "성공 기준", "수업 전 리허설 체크리스트", "보드 구성", "교사 준비 체크리스트", "문제 상황별 대체 플랜"].forEach((label) => {
    assert.ok(page.includes(label));
  });

  assert.ok(page.includes('content.worksheets.map((sheet) =>'));
  assert.ok(page.includes('<SimpleTable rows={content.fallbackPlan} />'));
  assert.ok(page.includes('content.teacherScripts.filter((s) => s.title.startsWith("3차시"))'));
  assert.ok(page.includes('content.teacherScripts.filter((s) => s.title.startsWith("4차시"))'));
  assert.ok(page.includes('["rehearsal", "리허설"]'));
  assert.ok(page.includes('["prep", "준비"]'));
});

test("lesson route is in page route inventory", async () => {
  const { PAGE_ROUTE_PATTERNS } = await import("@/lib/generated/pageRouteInventory");
  assert.ok(PAGE_ROUTE_PATTERNS.some((route) => route.patternPath === "/edu/vibe-coding/lesson-03-04"));
});

test("no ppt/pdf generation code added for this lesson", () => {
  const page = readFileSync(path.join(process.cwd(), "app/edu/vibe-coding/lesson-03-04/page.tsx"), "utf8").toLowerCase();
  const content = readFileSync(path.join(process.cwd(), "lib/edu/vibe-coding/lesson-03-04-content.ts"), "utf8").toLowerCase();
  assert.equal(/\.ppt|\.pptx|pdfkit|reportlab|puppeteer/.test(`${page}\n${content}`), false);
  assert.equal(existsSync(path.join(process.cwd(), "app/edu/vibe-coding/lesson-03-04/page.tsx")), true);
});
