import assert from "node:assert/strict";
import test from "node:test";

import { createWorldHubSeasonalDecorationAdapter } from "@/lib/world-hub/seasonal/adapter";

test("seasonal adapter resolves active window in spring", async () => {
  const adapter = createWorldHubSeasonalDecorationAdapter({
    now: () => new Date("2026-03-20T12:00:00.000Z"),
  });

  const resolved = await adapter.resolveState({
    context: {
      classId: "class-forest-1",
      worldId: "world-hub",
      sessionId: "session-1",
    },
  });

  assert.equal(resolved.status, "active");
  assert.ok(resolved.layers.length >= 1);
  assert.equal(resolved.layers.every((entry) => entry.status === "active"), true);
});

test("seasonal adapter resolves upcoming window before spring starts", async () => {
  const adapter = createWorldHubSeasonalDecorationAdapter({
    now: () => new Date("2026-02-15T12:00:00.000Z"),
  });

  const resolved = await adapter.resolveState({
    context: {
      classId: null,
      worldId: "world-hub",
      sessionId: "session-2",
    },
  });

  assert.equal(resolved.status, "upcoming");
  assert.ok(resolved.layers.length >= 1);
  assert.equal(resolved.layers.every((entry) => entry.active === false), true);
});
