import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (...segments: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

test("ComposeCardPanel has lessonMode prop and vibe coding gate for student mode", () => {
  const file = read("app", "_components", "ComposeCardPanel.tsx");
  assert.match(file, /lessonMode\?: "vibe_coding" \| null/);
  assert.match(file, /lessonMode = null/);
  assert.match(file, /const showVibeCodingTemplates = isStudent && lessonMode === "vibe_coding"/);
  assert.match(file, /바이브코딩 제출 도우미/);
  assert.match(file, /template\.label\.replace\(" 제출", ""\)/);
});

test("student max text length is 1000 in client and server", () => {
  const composeFile = read("app", "_components", "ComposeCardPanel.tsx");
  const routeFile = read("app", "api", "v1", "share", "[code]", "walls", "[wallId]", "cards", "route.ts");
  assert.match(composeFile, /const MAX_STUDENT_TEXT_LENGTH = 1000/);
  assert.match(routeFile, /if \(textLength > 1000\)/);
  assert.match(routeFile, /카드 내용은 1000자 이내로 입력해주세요\./);
});

test("existing student submit path pieces remain present", () => {
  const composeFile = read("app", "_components", "ComposeCardPanel.tsx");
  assert.match(composeFile, /TurnstileWidget/);
  assert.match(composeFile, /uploadFileToCard/);
  assert.match(composeFile, /routes\.api\.v1\("share", code, "walls", activeWallId, "cards"\)/);
});

test("no new student submission route or table was added", () => {
  const composeFile = read("app", "_components", "ComposeCardPanel.tsx");
  assert.doesNotMatch(composeFile, /api\/v1\/share\/.+\/submit-template/);
});

test("StudentBoardMinimal wires lessonMode from active lesson template id", () => {
  const file = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  assert.match(file, /activeLessonTemplateId\?: string \| null/);
  assert.match(file, /isVibeCodingLessonTemplateId\(activeLessonTemplateId\) \? "vibe_coding" : null/);
  assert.match(file, /lessonMode=\{lessonMode\}/);
});
