import assert from "node:assert/strict";
import test from "node:test";

import { getStudentDecorateResultCopy } from "@/lib/edu/lesson/studentDecorateUi";

test("student result copy is calm and clear", () => {
  assert.equal(getStudentDecorateResultCopy("preview_ready"), "미리보기가 준비됐어요.");
  assert.equal(getStudentDecorateResultCopy("apply_start"), "바뀐 내용을 적용하고 있어요.");
  assert.equal(getStudentDecorateResultCopy("applied"), "바뀐 내용이 적용됐어요.");
});
