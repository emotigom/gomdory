import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dataHandling = fs.readFileSync("docs/DATA_HANDLING_AND_SECURITY.md", "utf8");

test("data-handling: states no server-side student code execution and browser-side constraints", () => {
  ["서버사이드 학생 코드 실행 없음", "sandbox=\"allow-scripts\"", "allow-same-origin", "Pyodide Worker", "패키지 설치 기능은 제공하지 않습니다"].forEach((k) =>
    assert.ok(dataHandling.includes(k), k)
  );
});

test("data-handling: states official templates avoid personal identifiers", () => {
  ["학생 실명", "학교명", "전화번호", "주소", "이메일", "생년월일", "학번"].forEach((k) => assert.ok(dataHandling.includes(k), k));
});

test("data-handling: avoids unsupported certification and SLA claims", () => {
  ["보안감사 통과", "조달 승인 완료", "교육청 인증 완료", "SLA 보장 제공"].forEach((k) => assert.ok(!dataHandling.includes(k), k));
});
