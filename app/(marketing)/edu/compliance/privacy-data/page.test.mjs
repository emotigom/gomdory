import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(process.cwd(), "app/(marketing)/edu/compliance/privacy-data/page.tsx");

test("privacy-data compliance page includes key student data minimization claims", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  [
    "학생 계정 이메일",
    "학생 구글 계정",
    "학생 전화번호",
    "주소는 수집하지 않습니다",
    "교사만 이메일 또는 구글 로그인 계정",
    "학생 이메일 수집 안 함",
    "학생 구글 계정 수집 안 함",
    "학생 전화번호/주소 수집 안 함",
  ].forEach((k) => assert.ok(source.includes(k), k));
});

test("privacy-data compliance page avoids unsupported certification claims", () => {
  const source = fs.readFileSync(pagePath, "utf8");
  ["교육부 인증", "에듀집 승인", "공식 통과", "심의 완료", "인증 획득"].forEach((k) => assert.ok(!source.includes(k), k));
});
