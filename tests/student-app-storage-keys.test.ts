import assert from "node:assert/strict";
import test from "node:test";

import {
  STUDENT_APP_R2_PREFIX,
  buildStudentAppDeploymentPrefix,
  buildStudentAppFileR2Key,
} from "@/lib/student-apps/studentAppStorageKeys";

test("builds private deployment prefix", () => {
  const prefix = buildStudentAppDeploymentPrefix({
    boardId: "board_123e4567-e89b-12d3-a456-426614174000",
    deploymentId: "dep_123e4567-e89b-12d3-a456-426614174000",
    version: 2,
  });
  assert.equal(
    prefix,
    "student-apps/private/board_123e4567-e89b-12d3-a456-426614174000/dep_123e4567-e89b-12d3-a456-426614174000/v2/",
  );
  assert.match(prefix, /^student-apps\/private\//);
});

test("rejects unsafe boardId and deploymentId", () => {
  assert.throws(() => buildStudentAppDeploymentPrefix({ boardId: "bad/id", deploymentId: "dep", version: 1 }));
  assert.throws(() => buildStudentAppDeploymentPrefix({ boardId: "board", deploymentId: "dep name", version: 1 }));
});

test("rejects version less than 1", () => {
  assert.throws(() => buildStudentAppDeploymentPrefix({ boardId: "board", deploymentId: "dep", version: 0 }));
});

test("builds file key", () => {
  const prefix = "student-apps/private/board/dep/v1/";
  assert.equal(buildStudentAppFileR2Key(prefix, "assets/main.js"), "student-apps/private/board/dep/v1/assets/main.js");
});

test("rejects path traversal, absolute paths, and backslashes", () => {
  const prefix = `${STUDENT_APP_R2_PREFIX}/private/board/dep/v1/`;
  assert.throws(() => buildStudentAppFileR2Key(prefix, "../evil.js"));
  assert.throws(() => buildStudentAppFileR2Key(prefix, "/root.js"));
  assert.throws(() => buildStudentAppFileR2Key(prefix, "assets\\evil.js"));
});

test("prefix omits title or student name content", () => {
  const prefix = buildStudentAppDeploymentPrefix({
    boardId: "board-id",
    deploymentId: "deployment-id",
    version: 1,
  });
  assert.equal(prefix.includes("Alice"), false);
  assert.equal(prefix.includes("My Project Title"), false);
});
