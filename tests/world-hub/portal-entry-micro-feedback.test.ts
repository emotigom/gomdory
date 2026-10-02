import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubPortalEntryMicroFeedback } from "@/lib/world-hub/runtime/portalEntryMicroFeedback";

const portal = {
  id: "mission-orbit-lab",
  label: "Orbit Lab",
  statusLabel: "Mission join allowed",
  entryCue: "suggested" as const,
};

test("portal entry micro-feedback resolves warm confirmation for valid launch", () => {
  const resolved = resolveWorldHubPortalEntryMicroFeedback({
    event: {
      kind: "launching",
      portalId: portal.id,
      portalLabel: portal.label,
    },
    portal,
  });

  assert.equal(resolved.tone, "warm");
  assert.equal(resolved.eyebrow, "Portal entry");
  assert.match(resolved.title, /Orbit Lab/);
  assert.equal(resolved.chipLabel, "Today’s trail");
  assert.equal(resolved.expiresAfterMs, 2200);
});

test("portal entry micro-feedback resolves soft fallback when blocked", () => {
  const resolved = resolveWorldHubPortalEntryMicroFeedback({
    event: {
      kind: "blocked",
      portalId: portal.id,
      portalLabel: portal.label,
      detail: "Teacher launch window will open shortly.",
    },
    portal,
  });

  assert.equal(resolved.tone, "soft");
  assert.equal(resolved.chipLabel, "Try another trail");
  assert.match(resolved.detail, /open shortly/i);
  assert.equal(resolved.expiresAfterMs, 2600);
});

test("portal entry micro-feedback preserves deterministic fallback copy for unavailable portals", () => {
  const resolved = resolveWorldHubPortalEntryMicroFeedback({
    event: {
      kind: "unavailable",
      portalId: portal.id,
      portalLabel: portal.label,
      detail: "This gate is resting while your class finishes prep.",
    },
    portal,
  });

  assert.equal(resolved.kind, "unavailable");
  assert.equal(resolved.tone, "soft");
  assert.equal(resolved.chipLabel, "Opens soon");
  assert.equal(resolved.id, "unavailable:mission-orbit-lab");
});
