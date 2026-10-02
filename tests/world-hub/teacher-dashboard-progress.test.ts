import assert from "node:assert/strict";
import test from "node:test";

import {
  createTeacherDashboardMetaverseProgressAdapter,
  localPreviewTeacherDashboardMetaverseProgress,
  readTeacherDashboardMetaverseSummary,
} from "@/lib/world-hub/dashboard/teacherProgressAdapter";

function createAdminClientWithRows(rows: unknown[]) {
  return () =>
    ({
      from() {
        return {
          select() {
            return {
              async in(_column: string, values: string[]) {
                return {
                  data: rows.filter((row) => values.includes((row as { user_id: string }).user_id)),
                  error: null,
                };
              },
            };
          },
        };
      },
    }) as never;
}

test("teacher dashboard metaverse adapter resolves stable class-scoped summaries from persistence rows", async () => {
  const summary = await readTeacherDashboardMetaverseSummary({
    classroom: {
      classId: "class-astro-1",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
      students: [
        { studentId: "00000000-0000-4000-8000-000000000001", studentLabel: "Ari" },
        { studentId: "00000000-0000-4000-8000-000000000002", studentLabel: "Bea" },
      ],
    },
    createAdminClientFn: createAdminClientWithRows([
      {
        user_id: "00000000-0000-4000-8000-000000000001",
        world_id: "starter-world-hub",
        recent_completion: {
          missionId: "mission-orbit-lab",
          missionTitle: "Orbit Lab",
          completedAtIso: "2026-03-21T00:00:30.000Z",
          completionLabel: "3/3 objectives complete",
          objectiveCount: 3,
          completedObjectives: 3,
          percentComplete: 100,
          resultLabel: "Completion ready",
          resultDetail: "Preview-safe completion summary",
          returnHubPath: "/world-hub",
        },
        last_completed_mission: {
          worldId: "starter-world-hub",
          sessionId: "session-astro-1",
          missionId: "mission-orbit-lab",
          missionTitle: "Orbit Lab",
          completedAtIso: "2026-03-21T00:00:30.000Z",
          issuedAtIso: "2026-03-21T00:00:00.000Z",
          outcomeLabel: "Completed",
          persistenceStatus: "persisted",
        },
        updated_at: "2026-03-21T00:00:31.000Z",
      },
    ]),
  });

  assert.equal(summary.state, "ready");
  assert.equal(summary.scope.classId, "class-astro-1");
  assert.equal(summary.recentMissionCompletions.length, 1);
  assert.equal(summary.recentMissionCompletions[0]?.studentLabel, "Ari");
  assert.equal(summary.studentActivity[1]?.status, "no-activity");
  assert.equal(summary.aggregates.activeStudentCount, 1);
  assert.equal(summary.aggregates.missions[0]?.missionId, "mission-orbit-lab");
  assert.equal(summary.source.kind, "supabase-class-summary");
});

test("teacher dashboard metaverse adapter falls back deterministically when classroom context is unavailable", async () => {
  const summary = await localPreviewTeacherDashboardMetaverseProgress.readClassSummary({
    classroom: {
      classId: null,
      worldId: "local-preview-world",
      sessionId: null,
      students: [{ studentId: "preview-student-1", studentLabel: "Preview Student" }],
    },
  });

  assert.equal(summary.state, "empty");
  assert.equal(summary.scope.context, "preview-fallback");
  assert.equal(summary.studentActivity[0]?.status, "no-activity");
  assert.equal(summary.source.kind, "deterministic-local-preview");
  assert.equal(summary.source.fallbackReason, "preview-mode");
});

test("teacher dashboard metaverse adapter factory defers to deterministic fallback without classroom scope", async () => {
  const adapter = createTeacherDashboardMetaverseProgressAdapter({
    createAdminClientFn: createAdminClientWithRows([]),
  });

  const summary = await adapter.readClassSummary({ classroom: null });

  assert.equal(summary.state, "empty");
  assert.equal(summary.source.fallbackReason, "classroom-context-unavailable");
  assert.equal(summary.scope.worldId, "local-preview-world");
});


test("teacher dashboard metaverse adapter falls back deterministically when the summary read fails", async () => {
  const adapter = createTeacherDashboardMetaverseProgressAdapter({
    createAdminClientFn: () =>
      ({
        from() {
          return {
            select() {
              return {
                async in() {
                  return {
                    data: null,
                    error: { message: "boom" },
                  };
                },
              };
            },
          };
        },
      }) as never,
  });

  const summary = await adapter.readClassSummary({
    classroom: {
      classId: "class-astro-1",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
      students: [{ studentId: "00000000-0000-4000-8000-000000000001", studentLabel: "Student 01" }],
    },
  });

  assert.equal(summary.state, "empty");
  assert.equal(summary.source.kind, "deterministic-local-preview");
  assert.equal(summary.source.fallbackReason, "read-failed");
});

test("teacher dashboard metaverse adapter falls back deterministically when persisted rows are invalid", async () => {
  const summary = await readTeacherDashboardMetaverseSummary({
    classroom: {
      classId: "class-astro-1",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
      students: [{ studentId: "00000000-0000-4000-8000-000000000001", studentLabel: "Student 01" }],
    },
    createAdminClientFn: createAdminClientWithRows([
      {
        user_id: "00000000-0000-4000-8000-000000000001",
        world_id: "starter-world-hub",
        recent_completion: {},
        last_completed_mission: {},
        updated_at: "2026-03-21T00:00:31.000Z",
      },
    ]),
  });

  assert.equal(summary.state, "empty");
  assert.equal(summary.source.kind, "deterministic-local-preview");
  assert.equal(summary.source.fallbackReason, "invalid-payload");
});
