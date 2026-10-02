import test from "node:test";
import assert from "node:assert/strict";
import { redactEduAiText } from "@/lib/edu/ai/orchestrator/aiRedaction";

test("redacts email/phone/token/url query and metadata hides raw values", () => {
  const v = redactEduAiText("메일 a@b.com 전화 010-1234-5678 토큰 sk-abcdefabcdefabcdef1234 https://a.com/x?token=abc");
  assert.ok(v.redactedText.includes("[REDACTED_EMAIL]"));
  assert.ok(v.redactedText.includes("[REDACTED_PHONE]"));
  assert.ok(v.redactedText.includes("[REDACTED_TOKEN]"));
  assert.ok(v.redactedText.includes("?[REDACTED_URL_QUERY]"));
  assert.equal(JSON.stringify(v).includes("a@b.com"), false);
});

test("korean name pattern redaction and empty safe", () => {
  const v = redactEduAiText("내 이름은 민수 입니다. 저는 영희입니다");
  assert.ok(v.redactedText.includes("[REDACTED_NAME]"));
  const e = redactEduAiText(undefined);
  assert.equal(e.redactedText, "");
});
