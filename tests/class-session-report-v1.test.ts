import assert from "node:assert/strict";
import test from "node:test";

import { buildSessionReport } from "@/lib/reports/buildSessionReport";

test("buildSessionReport returns DTO without optional data", async () => {
  const report = await buildSessionReport(
    { classId: "class-1", sessionId: "session-1", userId: "user-1" },
    {
      getClass: async () => ({ id: "class-1", title: "테스트 클래스", short_code: "ABCD" }),
      getSession: async () => ({
        id: "session-1",
        board_id: "board-1",
        share_code: "share",
        title: "1회차 수업",
        started_at: new Date().toISOString(),
        ended_at: null,
        summary: null,
        teacher_notes: null,
        updated_at: null,
        class_id: "class-1",
        section_id: null,
        report: null,
      }),
      getBoard: async () => ({ id: "board-1", title: "테스트 보드" }),
      getSection: async () => null,
      listClips: async () => [],
      getPinnedQuestions: async () => [],
    },
  );

  assert.equal(report.classInfo.title, "테스트 클래스");
  assert.equal(report.session.title, "1회차 수업");
  assert.equal(report.stats.presencePeak, 0);
  assert.equal(report.polls.length, 0);
  assert.equal(report.pinnedQuestions.length, 0);
});
