import assert from "node:assert/strict";
import test from "node:test";

import {
  dedupeCheck,
  isWithinWindow,
  normalizeQuestionBody,
  QuestionGuardError,
  spamHeuristics,
} from "@/lib/data/questions";

test("normalizeQuestionBody trims, collapses spaces, and strips zero-width chars", () => {
  const input = "  질문\u200B   한   문장  ";
  const normalized = normalizeQuestionBody(input);
  assert.equal(normalized, "질문 한 문장");
});

test("normalizeQuestionBody enforces max length", () => {
  const input = "가".repeat(240);
  const normalized = normalizeQuestionBody(input);
  assert.equal(normalized.length, 200);
});

test("spamHeuristics flags obvious spam patterns", () => {
  assert.equal(spamHeuristics("ㅎㅎㅎㅎㅎㅎ"), true);
  assert.equal(spamHeuristics("😀😀😀"), true);
  assert.equal(spamHeuristics("https://example.com https://gom.dev"), true);
  assert.equal(spamHeuristics("질문이 있어요"), false);
});

test("isWithinWindow checks time window boundaries", () => {
  assert.equal(isWithinWindow(10_000, 5_000, 6_000), true);
  assert.equal(isWithinWindow(10_000, 1_000, 6_000), false);
});

test("dedupeCheck blocks duplicates within window", async () => {
  const originalNow = Date.now;
  try {
    Date.now = () => 1000;
    await dedupeCheck("code", "fingerprint", "질문");

    Date.now = () => 2000;
    await assert.rejects(
      () => dedupeCheck("code", "fingerprint", "질문"),
      (error) => {
        assert.ok(error instanceof QuestionGuardError);
        assert.equal(error.code, "DUPLICATE");
        return true;
      },
    );
  } finally {
    Date.now = originalNow;
  }
});
