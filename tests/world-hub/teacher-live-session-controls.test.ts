import assert from "node:assert/strict";
import test from "node:test";

import { createLocalPreviewTeacherLiveSessionControlAdapter } from "@/lib/world-hub/classroom/liveSession/adapter";
import { projectMetaverseLiveSessionGuidance } from "@/lib/world-hub/classroom/liveSession/projection";

test("teacher live session adapter resolves deterministic class-guided preview snapshot", async () => {
  const adapter = createLocalPreviewTeacherLiveSessionControlAdapter({
    now: () => new Date("2026-03-24T10:00:00.000Z"),
  });

  const snapshot = await adapter.resolveSnapshot({
    context: {
      scope: "world-hub",
      classId: "class-101",
      worldId: "starter-world-hub",
      missionId: null,
      sessionId: "session-1",
    },
  });

  assert.equal(snapshot.state.phase, "guided-briefing");
  assert.equal(snapshot.state.missionStartPolicy, "teacher-cued");
  assert.equal(snapshot.studentGuidance.status, "teacher-guided");
  assert.equal(snapshot.studentGuidance.cueState, "gather_at_plaza");
  assert.equal(snapshot.source.kind, "local-preview");
  assert.equal(snapshot.scheduledLaunch.studentTiming.state, "closed_for_now");
  assert.equal(snapshot.source.diagnostics.resolvedAtIso, "2026-03-24T10:00:00.000Z");
});

test("student guidance projection stays redacted and excludes raw teacher control state", async () => {
  const adapter = createLocalPreviewTeacherLiveSessionControlAdapter({
    now: () => new Date("2026-03-24T10:00:00.000Z"),
  });
  const snapshot = await adapter.resolveSnapshot({
    context: {
      scope: "mission-room",
      classId: null,
      worldId: "starter-world-hub",
      missionId: "mission-orbit-lab",
      sessionId: "session-2",
    },
  });

  const guidance = projectMetaverseLiveSessionGuidance(snapshot);

  assert.equal(guidance.status, "mission-starting-soon");
  assert.equal(guidance.missionStart, "teacher-cued");
  assert.equal(guidance.cueState, "start_mission");
  assert.equal(guidance.launchTiming.state, "fallback_preview");
  assert.equal("state" in (guidance as Record<string, unknown>), false);
});

test("student guidance projection supports academy-prep cue variants without exposing teacher control payload", () => {
  const guidance = projectMetaverseLiveSessionGuidance({
    state: {
      phase: "guided-briefing",
      missionStartPolicy: "teacher-cued",
      guidanceLevel: "focused",
      guidanceVariant: "campfire",
    },
    studentGuidance: {
      status: "teacher-guided",
      missionStart: "teacher-cued",
      cueState: "prepare_at_academy",
      title: "Academy prep is active",
      detail: "Gather your team at the academy before launch.",
      hint: "Review the objective together and stay nearby.",
      guidanceVariant: "campfire",
    },
    scheduledLaunch: {
      studentTiming: {
        state: "opening_soon",
        title: "Launch opens soon",
        detail: "Stay nearby and get ready.",
        hint: "Keep your group together at the academy approach.",
        countdownLabel: "Opens in 5m",
        opensAtIso: "2026-03-24T10:05:00.000Z",
        closesAtIso: "2026-03-24T10:15:00.000Z",
      },
      source: {
        kind: "local-preview",
        label: "Deterministic local scheduled launch timing",
        detail: null,
        fallbackReason: null,
        diagnostics: {
          adapterKind: "local-preview",
          scope: "world-hub",
          hasClassContext: true,
          hasMissionContext: false,
          matchedWindowId: "window-a",
          resolvedAtIso: "2026-03-24T10:00:00.000Z",
        },
      },
    },
    source: {
      kind: "authoritative-worker",
      label: "Authoritative teacher session controls",
      detail: null,
      fallbackReason: null,
      diagnostics: {
        adapterKind: "worker-orchestrated",
        scope: "world-hub",
        hasClassContext: true,
        hasMissionContext: false,
        resolvedAtIso: "2026-03-24T10:00:00.000Z",
      },
    },
  });

  assert.equal(guidance.cueState, "prepare_at_academy");
  assert.equal("state" in (guidance as Record<string, unknown>), false);
});
