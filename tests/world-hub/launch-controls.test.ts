import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetaverseLaunchControlAdapter,
  defaultMetaverseLaunchControlAdapter,
  readMetaverseLaunchControlState,
} from "@/lib/world-hub/launch/adapter";

test("launch control adapter resolves a deterministic class-scoped snapshot", async () => {
  const launchControls = await readMetaverseLaunchControlState({
    context: {
      classId: "class-preview-mission-release",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
    },
  });

  assert.equal(launchControls.scope.classId, "class-preview-mission-release");
  assert.equal(launchControls.scope.context, "classroom");
  assert.equal(launchControls.metadata.state, "mission-overrides");
  assert.equal(launchControls.hubEntry.status, "allowed");
  assert.equal(launchControls.missionOverrides.length, 2);
  assert.equal(launchControls.missionOverrides[1]?.decision.status, "blocked");
  assert.equal(launchControls.diagnostics.snapshotKey, "preview-mission-release");
});

test("launch control adapter falls back to preview-open state without classroom context", async () => {
  const launchControls = await defaultMetaverseLaunchControlAdapter.resolveLaunchControls({
    context: {
      classId: null,
      worldId: "starter-world-hub",
      sessionId: null,
    },
  });

  assert.equal(launchControls.resolution, "fallback");
  assert.equal(launchControls.scope.context, "preview");
  assert.equal(launchControls.source.fallbackReason, "classroom-context-unavailable");
  assert.equal(launchControls.hubEntry.status, "allowed");
  assert.equal(launchControls.metadata.state, "open");
});

test("launch control adapter factory preserves stable local snapshot reads", async () => {
  const adapter = createMetaverseLaunchControlAdapter({
    context: {
      classId: "class-preview-locked",
      worldId: "starter-world-hub",
      sessionId: "session-astro-1",
    },
  });

  const launchControls = await adapter.resolveLaunchControls();

  assert.equal(launchControls.metadata.state, "blocked");
  assert.equal(launchControls.hubEntry.status, "blocked");
  assert.equal(launchControls.diagnostics.adapterKind, "local-preview-snapshot");
});
