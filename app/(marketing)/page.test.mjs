import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("app/(marketing)/page.tsx", "utf8");

test("homepage required privacy copy and canonical markers", () => {
  ["학생은 별도 회원가입이나 로그인 없이", "학생의 이메일", "구글 계정", "전화번호", "교사 계정", "개인정보처리방침", "학습지원 SW 기준 안내", 'data-landing-variant="canonical"', 'data-marker-version={MARKETING_HOME_CANONICAL_MARKER_VERSION}'].forEach((k) => assert.equal(source.includes(k), true, k));
});

test("homepage forbidden unsupported certification claims", () => {
  ["교육부 인증", "에듀집 승인", "공식 통과", "심의 완료", "인증 획득"].forEach((k) => assert.equal(source.includes(k), false, k));
});


test("homepage hero CTA should avoid 로그인 하기 label", () => {
  assert.equal(source.includes("로그인 하기"), false);
});
