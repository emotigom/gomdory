import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const joinSource = readFileSync("app/_components/JoinByCode.tsx", "utf8");
const entryPageSource = readFileSync("app/s/page.tsx", "utf8");

test("student entry keeps implementation details out of the visible page", () => {
  assert.match(joinSource, /학생 참여/);
  assert.match(joinSource, /공유 코드로 수업에 들어가기/);
  assert.match(joinSource, /로그인 없이 참여/);
  assert.doesNotMatch(joinSource, /Join POST endpoint/i);
  assert.doesNotMatch(joinSource, />\s*Join\s*</);
});

test("student entry uses consistent, direct Korean guidance", () => {
  assert.match(joinSource, /영문 대·소문자는 구분하지 않습니다/);
  assert.match(joinSource, /보안 확인 중입니다/);
  assert.match(entryPageSource, /보안 확인 시간이 지났습니다/);
  assert.doesNotMatch(`${joinSource}\n${entryPageSource}`, /괜찮아요|처리돼요|실패했어요|잠겼어요/);
});

test("student entry recovers cleanly after security-check failures", () => {
  assert.match(joinSource, /useCallback/);
  assert.match(joinSource, /showErrorText=\{false\}/);
  assert.match(joinSource, /setIsTurnstileEnabled\(false\)/);
  assert.match(joinSource, /disabled=\{isSubmitting \|\| isChallengePending\}/);
  assert.match(joinSource, /role="status" aria-live="polite"/);
});
