import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const dataHandling = fs.readFileSync("docs/DATA_HANDLING_AND_SECURITY.md", "utf8");

test("institutional: /school includes privacy/security section and current-vs-preparing table entries", () => {
  const reviewLinks = schoolPage.match(/const reviewLinks\s*=\s*(\[[\s\S]*?\])\s*as const/)?.[1] ?? "";
  ["/legal/privacy", "/legal/ai-privacy", "/legal/security", "/legal/accessibility"].forEach((href) =>
    assert.ok(reviewLinks.includes(`"${href}"`), href),
  );
  assert.match(schoolPage, /<h2[^>]*>검토 자료<\/h2>[\s\S]*?reviewLinks\.map/);
  assert.match(schoolPage, /const availableCapabilities\s*=\s*\[[^\]]*"교사 수업 보드"/);
  assert.match(schoolPage, /const plannedCapabilities\s*=\s*\[[^\]]*"기관 관리자"/);
  assert.match(schoolPage, /<h2[^>]*>준비 중<\/h2>[\s\S]*?\{plannedCapabilities\.map/);
});

test("institutional: data handling doc exists with required institutional sections", () => {
  ["학생 개인정보 최소화 원칙", "계정 및 게스트 접근 모델", "저장 가능한 학습 활동 데이터", "코드 실행 안전성"].forEach((k) =>
    assert.ok(dataHandling.includes(k), k)
  );
});
