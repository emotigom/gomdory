import assert from "node:assert/strict";
import test from "node:test";

import { buildStudentPreviewSummary } from "@/lib/edu/lesson/studentDecorateUi";

const baseIntent = {
  primaryIntent: "color" as const,
  secondaryIntents: [],
  colors: [],
  tone: [],
  emphasisTargets: [],
  imageTargets: [],
  rewriteTargets: [],
  confidence: 0.8,
  isAmbiguous: false,
};

test("preview summary honesty: background gradient prioritized", () => {
  const result = buildStudentPreviewSummary({
    plan: {
      version: 1,
      summary: "x",
      ops: [{ op: "set_surface_background", target: { kind: "slot", slot: "section_any" }, style: { mode: "gradient", palette: ["#f00", "#00f"] } }],
    },
    intent: baseIntent,
    styleIntent: "background_gradient",
  });
  assert.match(result.summary, /배경/);
  assert.equal(result.majorTargets[0], "background");
});

test("preview summary honesty: button/headline keeps major 1~2 targets", () => {
  const result = buildStudentPreviewSummary({
    plan: {
      version: 1,
      summary: "x",
      ops: [
        { op: "set_button_style", target: { kind: "slot", slot: "cta_primary" }, style: { emphasis: "strong" } },
        { op: "set_text_emphasis", target: { kind: "slot", slot: "heading_primary" }, style: { level: "strong" } },
        { op: "set_section_style", target: { kind: "slot", slot: "section_any" }, style: { spacingToneHint: "balanced" } },
      ],
    },
    intent: { ...baseIntent, primaryIntent: "emphasis" },
    styleIntent: "cta_emphasis",
  });
  assert.equal(result.majorTargets.length <= 2, true);
  assert.equal(result.majorTargets.includes("button"), true);
});
