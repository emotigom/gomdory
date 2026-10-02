import assert from "node:assert/strict";
import test from "node:test";

import { createLocalPreviewClassScheduledLaunchAdapter } from "@/lib/world-hub/classroom/scheduledLaunch/adapter";

test("scheduled launch adapter resolves open_now when current time is inside the deterministic class window", async () => {
  const adapter = createLocalPreviewClassScheduledLaunchAdapter({
    now: () => new Date("2026-03-24T14:10:00.000Z"),
  });

  const timing = await adapter.resolveTiming({
    context: {
      scope: "world-hub",
      classId: "e",
      worldId: "starter-world-hub",
      missionId: null,
      sessionId: "session-1",
    },
  });

  assert.equal(timing.studentTiming.state, "open_now");
  assert.equal(timing.source.kind, "local-preview");
  assert.equal(timing.source.diagnostics.matchedWindowId?.startsWith("preview-e"), true);
});

test("scheduled launch adapter resolves opening_soon before the deterministic class window opens", async () => {
  const adapter = createLocalPreviewClassScheduledLaunchAdapter({
    now: () => new Date("2026-03-24T13:50:00.000Z"),
  });

  const timing = await adapter.resolveTiming({
    context: {
      scope: "world-hub",
      classId: "e",
      worldId: "starter-world-hub",
      missionId: null,
      sessionId: "session-2",
    },
  });

  assert.equal(timing.studentTiming.state, "opening_soon");
  assert.match(timing.studentTiming.countdownLabel ?? "", /Opens in about/);
});

test("scheduled launch adapter resolves fallback_preview without class context", async () => {
  const adapter = createLocalPreviewClassScheduledLaunchAdapter({
    now: () => new Date("2026-03-24T14:45:00.000Z"),
  });

  const timing = await adapter.resolveTiming({
    context: {
      scope: "mission-room",
      classId: null,
      worldId: "starter-world-hub",
      missionId: "mission-orbit-lab",
      sessionId: "session-3",
    },
  });

  assert.equal(timing.studentTiming.state, "fallback_preview");
  assert.equal(timing.source.fallbackReason, "unavailable-config");
});
