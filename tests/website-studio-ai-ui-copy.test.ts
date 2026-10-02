import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("korean status copy includes hardened lifecycle labels", () => {
  const src = readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  for (const phrase of ["패키지 불러오는 중", "모델 후보 선택 중", "모델 다운로드/초기화 중", "AI 제안 생성 중", "안전 형식 검사 중", "제안 준비 완료", "실패", "안전 검사 통과"]) {
    assert.match(src, new RegExp(phrase));
  }
});

test("validation failure hides apply button by rendering error-only path", () => {
  const src = readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.match(src, /안전 형식 검사에 실패했습니다/);
});
