import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const schoolPage = fs.readFileSync("app/(marketing)/school/page.tsx", "utf8");
const registrationStatus = fs.readFileSync("lib/trust/registrationStatus.ts", "utf8");

test("trust: /school page includes institutional registration facts", () => {
  ["에듀집", "한국디지털교육협회", "학습지원 소프트웨어"].forEach((k) => assert.ok(schoolPage.includes(k), k));
});

test("trust: /school page keeps caution and avoids unsupported claims", () => {
  assert.ok(schoolPage.includes('import { registrationCaution } from "@/lib/trust/registrationStatus"'));
  assert.ok(schoolPage.includes("{registrationCaution}"));
  assert.ok(registrationStatus.includes("보안감사, 조달 승인, 교육청 공식 인증, 개인정보 영향평가 또는 SLA 보장을 대체하지 않습니다"));
  ["보안감사 통과", "조달 승인", "교육청 인증", "SLA 보장"].forEach((k) => assert.ok(!schoolPage.includes(k), k));
});
