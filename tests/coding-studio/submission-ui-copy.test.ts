import assert from "node:assert/strict";
import test from "node:test";

import { CODING_STUDIO_SUBMISSION_UI_COPY } from "@/lib/coding-studio/submissionUiCopy";

test("submission ui copy remains Korean-first calm labels", () => {
  assert.match(CODING_STUDIO_SUBMISSION_UI_COPY.submitAction, /제출/);
  assert.match(CODING_STUDIO_SUBMISSION_UI_COPY.reviewModeLabel, /검토/);
  assert.match(CODING_STUDIO_SUBMISSION_UI_COPY.reviewSheetTitle, /교사용/);
  assert.match(CODING_STUDIO_SUBMISSION_UI_COPY.reworkStripTitle, /다시 다듬기/);
  assert.match(CODING_STUDIO_SUBMISSION_UI_COPY.revisionSummaryTitle, /재제출/);
  assert.match(CODING_STUDIO_SUBMISSION_UI_COPY.firstFailureLine, /실패/);
});
