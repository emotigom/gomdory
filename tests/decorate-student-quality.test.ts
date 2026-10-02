import assert from "node:assert/strict";
import test from "node:test";

import { buildStudentOutcomeSummary, interpretStudentDecoratePrompt } from "@/lib/edu/lesson/studentDecorateUi";
import { routeDecorateIntent } from "@/lib/edu/lesson/decorateIntentRouter";
import { classifyDecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";

test("student summary honesty keeps weak phrasing conservative", () => {
  const summary = buildStudentOutcomeSummary({ majorTargets: ["button"], lowImpactPreview: true });
  assert.match(summary, /조금/);
});

test("student summary highlights strong background change", () => {
  const summary = buildStudentOutcomeSummary({ majorTargets: ["background"], lowImpactPreview: false });
  assert.equal(summary, "배경을 더 또렷하게 바꿨어요.");
});

test("student prompt normalization maps colloquial prompts", () => {
  const prompt = "예쁘게 바꿔줘";
  const intent = routeDecorateIntent(prompt);
  const style = classifyDecorateStyleIntent({ prompt, intent });
  const interpreted = interpretStudentDecoratePrompt({ prompt, intent, styleIntent: style.styleIntent });
  assert.equal(interpreted.normalizedPromptClass, "mood");
  assert.ok(["tone", "ambiguous"].includes(interpreted.primaryIntent));
});
