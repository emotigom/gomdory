import assert from "node:assert/strict";
import test from "node:test";
import { buildStudentAppSubmissionPrefix } from "@/lib/student-apps/studentAppStorageKeys";

test("builds submission prefix", () => {
  assert.equal(buildStudentAppSubmissionPrefix({ boardId: "board_1", submissionId: "sub-1" }), "student-apps/submissions/private/board_1/sub-1/");
});

test("rejects unsafe ids", () => {
  assert.throws(() => buildStudentAppSubmissionPrefix({ boardId: "../x", submissionId: "a" }));
});
