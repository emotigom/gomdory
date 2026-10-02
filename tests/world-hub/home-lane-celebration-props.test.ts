import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubAmbientFeedback } from "@/lib/world-hub/runtime/homeArrivalFeedback";
import type { WorldHubHomeLanePlaceholderSignal } from "@/lib/world-hub/runtime/homeLanePersonalization";
import { resolveWorldHubHomeLaneCelebrationProps } from "@/lib/world-hub/runtime/homeLaneCelebrationProps";

const runtimeFixture = {
  homeLane: {
    title: "Porch keepsakes",
    summary: "Fallback keepsakes summary",
    placeholders: [
      { id: "recent", label: "Recent post", kind: "recent-achievement", position: { x: 1, y: 1 } },
      { id: "badge", label: "Badge rail", kind: "badge-display", position: { x: 2, y: 1 } },
      { id: "mail", label: "Mail lantern", kind: "message-hook", position: { x: 3, y: 1 } },
      { id: "collectible", label: "Collectible shelf", kind: "collectible-expansion", position: { x: 4, y: 1 } },
    ],
  },
} as unknown as WorldHubRuntimeInputs;

const readySignals: WorldHubHomeLanePlaceholderSignal[] = [
  {
    id: "recent",
    label: "Recent post",
    kind: "recent-achievement",
    symbol: "★",
    accent: "#fbbf24",
    statusLabel: "ready",
    detail: "",
    projectionValue: "Completed",
    emphasis: "warm",
    state: "ready",
  },
  {
    id: "badge",
    label: "Badge rail",
    kind: "badge-display",
    symbol: "⬢",
    accent: "#38bdf8",
    statusLabel: "ready",
    detail: "",
    projectionValue: "Rewarded",
    emphasis: "soft",
    state: "ready",
  },
  {
    id: "mail",
    label: "Mail lantern",
    kind: "message-hook",
    symbol: "✉",
    accent: "#67e8f9",
    statusLabel: "ready",
    detail: "",
    projectionValue: null,
    emphasis: "soft",
    state: "ready",
  },
  {
    id: "collectible",
    label: "Collectible shelf",
    kind: "collectible-expansion",
    symbol: "◒",
    accent: "#fb7185",
    statusLabel: "ready",
    detail: "",
    projectionValue: "3 keepsakes",
    emphasis: "soft",
    state: "ready",
  },
];

test("resolveWorldHubHomeLaneCelebrationProps returns deterministic fallback for missing runtime", () => {
  const resolved = resolveWorldHubHomeLaneCelebrationProps({
    runtime: null,
    homeLaneSignals: readySignals,
    homeZoneState: "away",
    ambientFeedback: null,
  });

  assert.deepEqual(resolved, []);
});

test("resolveWorldHubHomeLaneCelebrationProps projects warm tones when return feedback is active", () => {
  const returnFeedback: WorldHubAmbientFeedback = {
    kind: "return",
    eyebrow: "Welcome back",
    title: "Nice job",
    detail: "Saved",
    tone: "return",
    chips: ["done"],
  };
  const resolved = resolveWorldHubHomeLaneCelebrationProps({
    runtime: runtimeFixture,
    homeLaneSignals: readySignals,
    homeZoneState: "arrived",
    ambientFeedback: returnFeedback,
  });

  assert.equal(resolved.length, 4);
  assert.equal(resolved.find((entry) => entry.placeholderId === "recent")?.kind, "spark-cluster");
  assert.equal(resolved.find((entry) => entry.placeholderId === "badge")?.tone, "warm");
  assert.equal(resolved.find((entry) => entry.placeholderId === "mail")?.kind, "lantern-halo");
  assert.equal(resolved.find((entry) => entry.placeholderId === "collectible")?.kind, "petal-ring");
});
