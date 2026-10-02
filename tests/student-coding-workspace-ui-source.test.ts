import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync("app/s/[code]/page.tsx", "utf8");
const panel = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");
const gallery = readFileSync("app/s/[code]/_components/StudentAppGalleryPanel.tsx", "utf8");

test("student coding workspace uses Korean classroom copy instead of English shell labels", () => {
  for (const text of [
    "학생 코딩 화면",
    "HTML/CSS/JS를 수정하고 오른쪽 미리보기로 확인한 뒤 제출해요.",
    "빠른 이동",
    "학생 보드로 돌아가기",
    "친구 작품 보기",
  ]) {
    assert.equal(pageSource.includes(text) || gallery.includes(text), true);
  }

  for (const text of [
    "Student coding workspace",
    "Student coding screen",
    "Submit or review classroom apps",
    "Workspace actions",
    "Friend apps are available as a secondary view",
    "Load template",
    "Clear editor",
    "File summary",
    "Recent submission status",
  ]) {
    assert.equal(pageSource.includes(text) || panel.includes(text), false);
  }
});

test("student coding workspace exposes editor preview divider and theme controls", () => {
  for (const text of [
    "HTML/CSS/JS 코드 편집",
    "화면 내용",
    "색과 모양",
    "버튼 움직임",
    "미리보기",
    "코드와 미리보기 너비 조절",
    "밝은 테마",
    "어두운 테마",
    "수업 템플릿 불러오기",
    "제출하기",
  ]) {
    assert.equal(panel.includes(text), true);
  }

  assert.match(panel, /role="separator"/);
  assert.match(panel, /role="tablist"/);
  assert.match(panel, /student-coding-main/);
  assert.match(panel, /grid-template-columns: minmax\(0, var\(--workspace-editor-width\)\) 16px minmax\(320px, 1fr\)/);
  assert.match(panel, /localStorage\.setItem\(THEME_STORAGE_KEY/);
  assert.match(panel, /localStorage\.setItem\(SPLIT_STORAGE_KEY/);
});

test("student coding workspace keeps existing submission and import contracts", () => {
  assert.match(panel, /source:\s*"manual_files"/);
  assert.match(panel, /filesToStudentAppManualFiles\(selectedFiles\)/);
  assert.match(panel, /importStudentStaticSiteZip/);
  assert.match(panel, /apiV1Path\("student-apps\/submit"\)/);
  assert.match(panel, /apiV1Path\("student-apps\/submissions\/status"\)/);
  assert.match(gallery, /apiV1Path\("student-apps\/gallery\/list"\)/);
  assert.match(gallery, /target="_blank"/);
  assert.match(gallery, /rel="noopener noreferrer"/);
  assert.doesNotMatch(gallery, /apiV1Path\("student-apps\/gallery\/detail"\)/);
  assert.doesNotMatch(panel, /WebLLM|automatic progress storage|vite build|next build|npm install/i);
});

test("student coding workspace exposes the local code coach without model loading copy", () => {
  for (const text of [
    "코드 점검 도우미",
    "지금 작성한 코드를 빠르게 살펴봐요",
    "제출을 막는 검사는 아니에요",
    "확인됨",
    "살펴보기",
    "도전 미션",
  ]) {
    assert.equal(panel.includes(text), true);
  }

  assert.match(panel, /runRuleBasedCodeCoach/);
  assert.match(panel, /setCoachItems/);
  assert.doesNotMatch(panel, /WebLLM|AI 코치|모델 로딩|model loading|download model|@mlc-ai\/web-llm/i);
});
