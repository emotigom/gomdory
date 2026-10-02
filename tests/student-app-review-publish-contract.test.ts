import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewRoute = readFileSync("app/api/v1/dashboard/student-apps/submissions/review/route.ts", "utf8");
const teacherListRoute = readFileSync("app/api/v1/dashboard/student-apps/submissions/list/route.ts", "utf8");
const publishRoute = readFileSync("app/api/v1/dashboard/student-apps/publish/route.ts", "utf8");
const publishService = readFileSync("lib/student-apps/publishStudentAppDeployment.ts", "utf8");
const inspector = readFileSync("app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector.tsx", "utf8");

test("teacher review flow keeps existing submission statuses and gallery visibility contract", () => {
  assert.match(reviewRoute, /type ReviewAction = "needs_fix" \| "accepted" \| "archived" \| "reopen"/);
  assert.match(reviewRoute, /action === "needs_fix" \? \{ status: "needs_fix"/);
  assert.match(reviewRoute, /action === "accepted" \? \{ status: "accepted"/);
  assert.match(reviewRoute, /action === "accepted".*archivedAt: null/);
  assert.match(reviewRoute, /toSnakeKeys\(patch\)/);
  assert.match(reviewRoute, /latest_submission_required/);
  assert.match(reviewRoute, /action === "archived" \? \{ status: "archived"/);
  assert.match(reviewRoute, /\{ status: "submitted", archivedAt: null, reviewedAt: null \}/);
  assert.doesNotMatch(reviewRoute, /published|hidden|pending|reviewing/);

  assert.match(inspector, /selectedSubmissionCanPublish = selectedSubmission\?\.isLatest === true/);
  assert.match(inspector, /action === "accepted" && !selectedSubmissionCanPublish/);
  assert.match(inspector, /disabled=\{reviewBusy \|\| !selectedSubmissionCanPublish\}/);
});

test("teacher-only review and publish routes keep board ownership checks", () => {
  assert.match(reviewRoute, /requireUserApi/);
  assert.match(reviewRoute, /owner_id/);
  assert.match(reviewRoute, /boardRes\.data\.owner_id !== userId/);
  assert.match(teacherListRoute, /requireUserApi/);
  assert.match(teacherListRoute, /owner_id/);
  assert.match(teacherListRoute, /student_note/);
  assert.match(teacherListRoute, /teacher_note/);

  assert.match(publishRoute, /requireUserApi/);
  assert.match(publishRoute, /publishStudentAppDeployment/);
  assert.match(publishRoute, /unpublishStudentAppDeployment/);
  assert.match(publishService, /verifyBoardOwner/);
  assert.match(publishService, /boardRes\.data\.owner_id !== input\.userId/);
  assert.match(publishService, /\["stored", "approved", "published"\]\.includes\(row\.status\)/);
  assert.match(publishService, /status: "published"/);
  assert.match(publishService, /status: "stored"/);
});
