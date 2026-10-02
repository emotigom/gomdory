import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDecorateContrastGuard } from "@/lib/edu/lesson/decorateContrastGuard";

test("contrast guard adjusts low contrast button text", () => {
  const guarded = evaluateDecorateContrastGuard({
    version: 1,
    summary: "x",
    ops: [{ op: "set_button_style", target: { kind: "selector", selector: ".cta" }, style: { background: "#fef08a", textColor: "#ffffff" } }],
  });
  assert.ok(guarded.adjustmentsApplied.includes("button_text_color_adjusted"));
  assert.ok(guarded.score < 1);
});

test("multi-op guard reduces accent saturation and enforces gradient legibility", () => {
  const guarded = evaluateDecorateContrastGuard({
    version: 1,
    summary: "x",
    ops: [
      { op: "set_surface_background", target: { kind: "slot", slot: "section_any" }, style: { mode: "gradient", gradientFrom: "#ff0066", gradientTo: "#ff6600" } },
      { op: "set_accent_style", target: { kind: "selector", selector: ".badge" }, style: { accentColor: "#ff0066", textColor: "#ff99cc" } },
    ],
  });
  assert.ok(guarded.adjustmentsApplied.includes("gradient_text_legibility_enforced"));
  assert.ok(guarded.adjustmentsApplied.includes("accent_saturation_reduced"));
});
