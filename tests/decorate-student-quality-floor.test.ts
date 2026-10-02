import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDecoratePreviewQuality, raiseFallbackQualityFloor } from "@/lib/edu/lesson/decorateGuards";
import { buildStudentOutcomeSummary, inferStudentMajorTargetsFromPlan } from "@/lib/edu/lesson/studentDecorateUi";

test("fallback quality floor raised for background intent", () => {
  const raised = raiseFallbackQualityFloor({
    nextHtml: "<main><h1>Title</h1><p>Body</p></main>",
    intent: {
      primaryIntent: "background",
      secondaryIntents: [],
      colors: ["blue"],
      tone: [],
      emphasisTargets: [],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.8,
      isAmbiguous: false,
    },
    styleIntent: "background_gradient",
  });
  assert.equal(raised.raised, true);
  assert.match(raised.nextHtml, /data-student-floor="background"/);
});

test("weak preview detection exposes low impact and no visible change", () => {
  const quality = evaluateDecoratePreviewQuality({
    beforeHtml: "<main><h1>T</h1></main>",
    nextHtml: "<main><h1>T</h1></main>",
    changedFiles: 1,
    prompt: "좀 더 귀엽게 꾸며줘",
  });
  assert.equal(quality.lowImpactPreview, true);
  assert.equal(quality.studentVisibleChange, false);
});

test("summary honesty uses actual op targets", () => {
  const majorTargets = inferStudentMajorTargetsFromPlan({
    version: 1,
    summary: "x",
    ops: [{ op: "set_text_emphasis", target: { kind: "slot", slot: "heading_primary" }, style: { emphasisStrength: "strong" } }],
  });
  const summary = buildStudentOutcomeSummary({ majorTargets, lowImpactPreview: false });
  assert.match(summary, /제목/);
});
