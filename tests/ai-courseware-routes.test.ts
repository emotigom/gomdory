import test from "node:test";
import assert from "node:assert/strict";
import { aiCoursewareDayHref, aiCoursewareOverviewHref } from "@/lib/edu/courseware/aiCoursewareRoutes";

test("ai courseware day href preserves boardId", () => {
  assert.equal(aiCoursewareDayHref(1), "/edu/lesson/day/1");
  assert.equal(aiCoursewareDayHref(32, { boardId: "b-1" }), "/edu/lesson/day/32?boardId=b-1");
  assert.equal(aiCoursewareOverviewHref({ boardId: "board a" }), "/edu/lesson/teacher?boardId=board%20a");
});

test("ai courseware day href rejects invalid day", () => {
  assert.throws(() => aiCoursewareDayHref(0));
  assert.throws(() => aiCoursewareDayHref(33));
});
