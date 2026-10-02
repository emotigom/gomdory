import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  composerFeedbackMessages,
  composerFeedbackSemantics,
  isTerminalComposerSuccess,
  makeComposerFeedback,
} from "../lib/student/cardComposerFeedback.mjs";

const smartLayer = fs.readFileSync("app/s/[code]/_components/StudentGuestBoardSmartLayer.tsx", "utf8");

test("composer feedback maps pending and terminal outcomes to one semantic region", () => {
  assert.deepEqual(composerFeedbackSemantics("pending"), { role: "status", live: "polite" });
  assert.deepEqual(composerFeedbackSemantics("success"), { role: "status", live: "polite" });
  assert.deepEqual(composerFeedbackSemantics("partial-success"), { role: "status", live: "polite" });
  assert.deepEqual(composerFeedbackSemantics("retryable-error"), { role: "alert", live: "assertive" });
  assert.deepEqual(composerFeedbackSemantics("terminal-error"), { role: "alert", live: "assertive" });
  assert.equal(composerFeedbackSemantics("idle"), null);
});

test("partial attachment results cannot be classified as complete success", () => {
  assert.equal(isTerminalComposerSuccess({ cardId: "opaque-card", hasFiles: false, finalizedAttachments: 0, selectedAttachments: 0 }), true);
  assert.equal(isTerminalComposerSuccess({ cardId: "opaque-card", hasFiles: true, finalizedAttachments: 2, selectedAttachments: 2 }), true);
  assert.equal(isTerminalComposerSuccess({ cardId: "opaque-card", hasFiles: true, finalizedAttachments: 1, selectedAttachments: 2 }), false);
  assert.equal(isTerminalComposerSuccess({ cardId: "opaque-card", hasFiles: true, finalizedAttachments: 0, selectedAttachments: 1 }), false);
});

test("feedback event keys are stable per terminal event and never include private content", () => {
  const first = makeComposerFeedback("partial-success", 7, composerFeedbackMessages.partial);
  const repeat = makeComposerFeedback("partial-success", 7, composerFeedbackMessages.partial);
  const next = makeComposerFeedback("partial-success", 8, composerFeedbackMessages.partial);
  assert.equal(first.eventKey, repeat.eventKey);
  assert.notEqual(first.eventKey, next.eventKey);
  assert.match(first.eventKey, /^student-compose:\d+:partial-success$/);
  for (const value of [JSON.stringify(first), ...Object.values(composerFeedbackMessages)]) {
    assert.doesNotMatch(value, /student name|card body|filename|opaque-card/i);
  }
});

test("composer has one polite status region, one conditional alert, and a persistent terminal result", () => {
  assert.match(smartLayer, /id="student-card-composer-status"[\s\S]{0,240}role="status"[\s\S]{0,120}aria-live="polite"/);
  assert.match(smartLayer, /feedbackSemantics\?\.role === "alert" \? \([\s\S]{0,240}id="student-card-composer-error"[\s\S]{0,120}role="alert"/);
  assert.match(smartLayer, /!composer && composerFeedbackSemantics\(feedback\.kind\)\?\.role === "status"/);
  assert.match(smartLayer, /data-testid="student-card-compose-result"[\s\S]{0,240}data-feedback-event-key=\{feedback\.eventKey\}/);
  assert.match(smartLayer, /submitGuardRef\.current = true/);
  assert.match(smartLayer, /if \(!composer \|\| submitting \|\| submitGuardRef\.current \|\| writeLockedMessage\) return;/);
  assert.doesNotMatch(smartLayer, /setError\(|status=\{status\}|error=\{error\}/);
});
