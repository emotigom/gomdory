import assert from "node:assert/strict";
import test from "node:test";

import { resolveCodingStudioEntrySource, resolveReworkEntryNotice, shouldShowStudioFirstEntryOnboarding } from "@/lib/coding-studio/studioEntry";

test("first-entry onboarding appears only for academy entry and can be dismissed", () => {
  assert.equal(shouldShowStudioFirstEntryOnboarding({ entry: "academy", dismissed: false }), true);
  assert.equal(shouldShowStudioFirstEntryOnboarding({ entry: "academy", dismissed: true }), false);
  assert.equal(shouldShowStudioFirstEntryOnboarding({ entry: null, dismissed: false }), false);
});

test("entry source distinguishes academy free vs assigned resume", () => {
  assert.equal(resolveCodingStudioEntrySource({ entry: "academy", hasActiveAssignment: false }), "academy-free");
  assert.equal(resolveCodingStudioEntrySource({ entry: "academy", hasActiveAssignment: true }), "academy-assigned");
  assert.equal(resolveCodingStudioEntrySource({ entry: "assignment", hasActiveAssignment: true }), "assigned-resume");
  assert.equal(resolveCodingStudioEntrySource({ entry: null, hasActiveAssignment: false }), "free-practice");
});

test("rework entry notice appears only when submission and feedback exist", () => {
  assert.equal(resolveReworkEntryNotice({ latestSubmissionExists: false, feedbackCount: 1, primaryFocus: "목표 조건" }), null);
  const notice = resolveReworkEntryNotice({ latestSubmissionExists: true, feedbackCount: 2, primaryFocus: "반복 조건" });
  assert.ok(notice);
  assert.match(notice?.title ?? "", /다시 다듬기/);
  assert.match(notice?.focusLine ?? "", /반복 조건/);
});
