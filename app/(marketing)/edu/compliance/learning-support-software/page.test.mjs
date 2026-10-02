import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(process.cwd(), "app/(marketing)/edu/compliance/learning-support-software/page.tsx");

test("learning-support compliance page includes review-stage evidence wording and checklist references", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  const requiredKeywords = [
    "본 페이지는 학교와 에듀집 검토에 필요한 개인정보 처리 기준과 증빙 위치를 안내하는 공개 자료입니다",
    "적용됨",
    "절차 운영됨",
    "공개됨",
    "개인정보처리방침 제1조",
    "개인정보처리방침 제3조",
  ];

  for (const keyword of requiredKeywords) {
    assert.equal(source.includes(keyword), true, `Expected compliance page to include keyword: ${keyword}`);
  }
});

test("learning-support compliance page excludes defensive or unfinished wording", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  ["이 페이지는 공식 인증 또는 심의 통과 사실을 의미하지 않으며", "적용 중", "공개 중", "준비 중", "충족 예정"].forEach((k) => {
    assert.equal(source.includes(k), false, `Expected compliance page to exclude keyword: ${k}`);
  });
});
