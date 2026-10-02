import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TeacherMetaverseProgressSurface from "@/app/world-hub/dashboard/teacher-progress/TeacherMetaverseProgressSurface";
import { parseTeacherDashboardMetaverseSummary } from "@/lib/world-hub/dashboard/contracts";
import { parseMetaverseResolvedLaunchControlState } from "@/lib/world-hub/launch/contracts";

test("teacher metaverse progress surface renders stable summary sections", () => {
  const summary = parseTeacherDashboardMetaverseSummary({
    version: 1,
    state: "ready",
    scope: {
      classId: "class-astro-1",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
      studentCount: 2,
      context: "classroom",
    },
    recentMissionCompletions: [
      {
        studentId: "student-1",
        studentLabel: "Student 01",
        worldId: "starter-world-hub",
        sessionId: "session-astro-1",
        missionId: "mission-orbit-lab",
        missionTitle: "Orbit Lab",
        completedAtIso: "2026-03-21T00:00:30.000Z",
        completionLabel: "3/3 objectives complete",
        percentComplete: 100,
        resultLabel: "Completion ready",
        persistenceStatus: "persisted",
      },
    ],
    studentActivity: [
      {
        studentId: "student-1",
        studentLabel: "Student 01",
        status: "active",
        lastActivityAtIso: "2026-03-21T00:00:30.000Z",
        worldId: "starter-world-hub",
        sessionId: "session-astro-1",
        missionId: "mission-orbit-lab",
        missionTitle: "Orbit Lab",
        persistenceStatus: "persisted",
      },
      {
        studentId: "student-2",
        studentLabel: "Student 02",
        status: "no-activity",
        lastActivityAtIso: null,
        worldId: null,
        sessionId: null,
        missionId: null,
        missionTitle: null,
        persistenceStatus: null,
      },
    ],
    aggregates: {
      studentCount: 2,
      activeStudentCount: 1,
      completionCount: 1,
      latestActivityAtIso: "2026-03-21T00:00:30.000Z",
      missions: [
        {
          missionId: "mission-orbit-lab",
          missionTitle: "Orbit Lab",
          completionCount: 1,
          uniqueStudentCount: 1,
          latestCompletedAtIso: "2026-03-21T00:00:30.000Z",
        },
      ],
      worlds: [
        {
          worldId: "starter-world-hub",
          completionCount: 1,
          uniqueStudentCount: 1,
          latestCompletedAtIso: "2026-03-21T00:00:30.000Z",
        },
      ],
    },
    source: {
      kind: "supabase-class-summary",
      label: "Supabase metaverse class summary",
      detail: "Loaded 1 class-scoped metaverse progress summary record(s).",
      fallbackReason: null,
      diagnostics: {
        mode: "supabase",
        endpoint: "/world-hub/api/progress",
        classroomContext: "resolved",
        queriedStudentCount: 2,
        matchedStudentCount: 1,
        readStatus: "succeeded",
        syncedAtIso: "2026-03-21T00:00:31.000Z",
      },
    },
  });
  const launchControls = parseMetaverseResolvedLaunchControlState({
    version: 1,
    scope: {
      classId: "class-astro-1",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
      context: "classroom",
    },
    source: {
      kind: "local-preview-snapshot",
      label: "Local preview launch snapshot",
      detail: "Deterministic launch control preview.",
      fallbackReason: "preview-mode",
    },
    resolution: "resolved",
    preview: {
      mode: "local-snapshot",
      fallback: "inherit-mission-availability",
      label: "Class snapshot preview",
      detail: "detail",
    },
    metadata: {
      state: "mission-overrides",
      stateLabel: "Mission-specific release overrides",
      summary: "Preview mission overrides are active.",
      updatedAtIso: "2026-03-22T00:00:00.000Z",
      effectiveFromIso: null,
      expiresAtIso: null,
    },
    hubEntry: {
      status: "allowed",
      code: "allowed",
      label: "World hub entry allowed",
      detail: "World hub is open.",
    },
    missionOverrides: [
      {
        missionId: "mission-orbit-lab",
        mode: "allowed",
        decision: {
          status: "allowed",
          code: "mission-allowed",
          label: "Mission release open",
          detail: "Orbit Lab is open.",
        },
        detail: "Orbit Lab override.",
      },
    ],
    diagnostics: {
      adapterKind: "local-preview-snapshot",
      resolution: "resolved",
      scopeContext: "classroom",
      snapshotKey: "preview-mission-release",
      missionOverrideCount: 1,
      evaluatedAtIso: "2026-03-22T00:01:00.000Z",
      summary: "Resolved snapshot.",
    },
  });

  const markup = renderToStaticMarkup(
    <TeacherMetaverseProgressSurface
      classId="class-astro-1"
      classTitle="Astro Class"
      summary={summary}
      launchControls={launchControls}
    />,
  );

  assert.match(markup, /Teacher Metaverse Progress/);
  assert.match(markup, /Launch controls snapshot/);
  assert.match(markup, /Mission-specific release overrides/);
  assert.match(markup, /Recent mission completions/);
  assert.match(markup, /Recent student activity/);
  assert.match(markup, /Mission and world aggregates/);
  assert.match(markup, /Source and fallback diagnostics/);
  assert.match(markup, /Student 01/);
  assert.match(markup, /Orbit Lab/);
});

test("teacher metaverse progress surface renders preview fallback empty state copy", () => {
  const summary = parseTeacherDashboardMetaverseSummary({
    version: 1,
    state: "empty",
    scope: {
      classId: "class-preview-1",
      worldId: "starter-world-hub",
      sessionId: null,
      studentCount: 0,
      context: "preview-fallback",
    },
    recentMissionCompletions: [],
    studentActivity: [],
    aggregates: {
      studentCount: 0,
      activeStudentCount: 0,
      completionCount: 0,
      latestActivityAtIso: null,
      missions: [],
      worlds: [],
    },
    source: {
      kind: "deterministic-local-preview",
      label: "Deterministic local teacher summary",
      detail: "Classroom context is unavailable, so the teacher progress adapter returned a deterministic local preview summary.",
      fallbackReason: "preview-mode",
      diagnostics: {
        mode: "local-preview",
        endpoint: null,
        classroomContext: "preview",
        queriedStudentCount: 0,
        matchedStudentCount: 0,
        readStatus: "fallback",
        syncedAtIso: null,
      },
    },
  });
  const launchControls = parseMetaverseResolvedLaunchControlState({
    version: 1,
    scope: {
      classId: "class-preview-1",
      worldId: "starter-world-hub",
      sessionId: null,
      context: "classroom",
    },
    source: {
      kind: "local-preview-snapshot",
      label: "Local preview launch snapshot",
      detail: "Deterministic launch control preview.",
      fallbackReason: "preview-mode",
    },
    resolution: "resolved",
    preview: {
      mode: "local-snapshot",
      fallback: "inherit-mission-availability",
      label: "Class snapshot preview",
      detail: "detail",
    },
    metadata: {
      state: "open",
      stateLabel: "World hub open",
      summary: "World hub entry is open.",
      updatedAtIso: "2026-03-22T00:00:00.000Z",
      effectiveFromIso: null,
      expiresAtIso: null,
    },
    hubEntry: {
      status: "allowed",
      code: "preview-allowed",
      label: "World hub entry allowed",
      detail: "detail",
    },
    missionOverrides: [],
    diagnostics: {
      adapterKind: "local-preview-snapshot",
      resolution: "resolved",
      scopeContext: "classroom",
      snapshotKey: "default-open-preview",
      missionOverrideCount: 0,
      evaluatedAtIso: "2026-03-22T00:01:00.000Z",
      summary: "Resolved snapshot.",
    },
  });

  const markup = renderToStaticMarkup(
    <TeacherMetaverseProgressSurface
      classId="class-preview-1"
      classTitle="Preview Class"
      summary={summary}
      launchControls={launchControls}
    />,
  );

  assert.match(markup, /Preview fallback active/);
  assert.match(markup, /No mission completions yet/);
  assert.match(markup, /No students in metaverse scope/);
  assert.match(markup, /World hub open/);
});
