import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPracticeSubmissionTitle,
  getPracticeSubmissionFeedbackUrl,
  isPracticeSubmissionCard,
} from "@/lib/edu/practiceSubmission";

test("isPracticeSubmissionCard detects title prefix + practice attachment", () => {
  assert.equal(
    isPracticeSubmissionCard({
      text: "제출: 익명",
      external_attachments: [{ kind: "practice", title: "실습", html: "<h1>x</h1>", css: "", js: "" }],
    }),
    true,
  );

  assert.equal(
    isPracticeSubmissionCard({
      text: "제출: 학생",
      external_attachments: [{ kind: "link", url: "https://example.com", filename: "링크" }],
    }),
    false,
  );

  assert.equal(
    isPracticeSubmissionCard({
      text: "일반 카드",
      external_attachments: [{ kind: "practice", title: "실습", html: "", css: "", js: "" }],
    }),
    false,
  );
});

test("buildPracticeSubmissionTitle defaults to anonymous", () => {
  assert.equal(buildPracticeSubmissionTitle("민수"), "제출: 민수");
  assert.equal(buildPracticeSubmissionTitle("   "), "제출: 익명");
});

test("getPracticeSubmissionFeedbackUrl picks tagged feedback first", () => {
  const card = {
    text: "제출: 익명",
    external_attachments: [
      { kind: "practice", title: "실습", html: "", css: "", js: "", url: "https://example.com/work" },
      { kind: "feedback", url: "https://example.com/feedback", filename: "피드백" },
    ],
  };

  assert.equal(getPracticeSubmissionFeedbackUrl(card), "https://example.com/feedback");
});

test("getPracticeSubmissionFeedbackUrl falls back to non-practice link on practice cards", () => {
  const card = {
    text: "제출: 학생",
    external_attachments: [
      { kind: "practice", title: "실습", html: "", css: "", js: "", url: "https://example.com/work" },
      { kind: "link", url: "https://example.com/fallback", filename: "참고" },
    ],
  };

  assert.equal(getPracticeSubmissionFeedbackUrl(card), "https://example.com/fallback");
});
