import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeHasDismissedNewBoardOnboarding,
  resolveHasDismissedNewBoardOnboardingFromPrefs,
  shouldShowNewBoardOnboarding,
} from "@/lib/dashboard/newBoardOnboarding";

test("normalizeHasDismissedNewBoardOnboarding defaults to false", () => {
  assert.equal(normalizeHasDismissedNewBoardOnboarding(true), true);
  assert.equal(normalizeHasDismissedNewBoardOnboarding(false), false);
  assert.equal(normalizeHasDismissedNewBoardOnboarding("true"), false);
  assert.equal(normalizeHasDismissedNewBoardOnboarding(undefined), false);
});

test("resolveHasDismissedNewBoardOnboardingFromPrefs reads camelCase key only", () => {
  assert.equal(resolveHasDismissedNewBoardOnboardingFromPrefs({ hasDismissedNewBoardOnboarding: true }), true);
  assert.equal(resolveHasDismissedNewBoardOnboardingFromPrefs({ hasDismissedNewBoardOnboarding: false }), false);
  assert.equal(resolveHasDismissedNewBoardOnboardingFromPrefs({ has_dismissed_new_board_onboarding: true }), false);
  assert.equal(resolveHasDismissedNewBoardOnboardingFromPrefs(null), false);
});

test("shouldShowNewBoardOnboarding hides when dismissed", () => {
  assert.equal(
    shouldShowNewBoardOnboarding({
      hasDismissed: true,
      boardId: "board-1",
      createdBoardId: "board-1",
    }),
    false,
  );
});

test("shouldShowNewBoardOnboarding shows only when created board matches", () => {
  assert.equal(
    shouldShowNewBoardOnboarding({
      hasDismissed: false,
      boardId: "board-1",
      createdBoardId: "board-1",
    }),
    true,
  );

  assert.equal(
    shouldShowNewBoardOnboarding({
      hasDismissed: false,
      boardId: "board-1",
      createdBoardId: "board-2",
    }),
    false,
  );

  assert.equal(
    shouldShowNewBoardOnboarding({
      hasDismissed: false,
      boardId: "board-1",
      createdBoardId: null,
    }),
    false,
  );
});
