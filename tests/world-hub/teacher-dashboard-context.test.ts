import assert from "node:assert/strict";
import test from "node:test";

import { resolveTeacherDashboardMetaverseContext } from "@/lib/world-hub/dashboard/teacherProgressContext";

function createAdminClientWithBoardMembers(rows: unknown[]) {
  return () =>
    ({
      from() {
        return {
          select() {
            return {
              async in(_column: string, values: string[]) {
                return {
                  data: rows.filter((row) => values.includes((row as { board_id: string }).board_id)),
                  error: null,
                };
              },
            };
          },
        };
      },
    }) as never;
}

test("teacher metaverse context resolver de-duplicates board members into privacy-safe student references", async () => {
  const context = await resolveTeacherDashboardMetaverseContext({
    classId: "class-astro-1",
    boardIds: ["board-1", "board-2"],
    ownerUserId: "teacher-1",
    createAdminClientFn: createAdminClientWithBoardMembers([
      { board_id: "board-1", user_id: "teacher-1", created_at: "2026-03-20T10:00:00.000Z" },
      { board_id: "board-1", user_id: "student-b", created_at: "2026-03-20T10:03:00.000Z" },
      { board_id: "board-2", user_id: "student-a", created_at: "2026-03-20T10:01:00.000Z" },
      { board_id: "board-2", user_id: "student-b", created_at: "2026-03-20T10:04:00.000Z" },
    ]),
  });

  assert.equal(context.classId, "class-astro-1");
  assert.equal(context.worldId, "starter-world-hub");
  assert.deepEqual(context.students, [
    { studentId: "student-a", studentLabel: "Student 01" },
    { studentId: "student-b", studentLabel: "Student 02" },
  ]);
});

test("teacher metaverse context resolver returns deterministic empty student scope when the class has no boards", async () => {
  const context = await resolveTeacherDashboardMetaverseContext({
    classId: "class-preview-1",
    boardIds: [],
  });

  assert.equal(context.classId, "class-preview-1");
  assert.equal(context.students.length, 0);
  assert.equal(context.sessionId, "starter-world-hub-local-session");
});
