import test from "node:test";
import assert from "node:assert/strict";
import { AI_LEARNING_SPINE_CATALOG } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineCatalog";
import { DEFAULT_PUBLISH_SCOPE, TEACHER_RUBRIC_DOMAINS } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineTypes";
import { getAiLearningSpineDraft, saveAiLearningSpineDraft } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineStore";
import { getAiLearningSpineByLesson } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineCatalog";

test("catalog has 32 lessons", () => {
  assert.equal(AI_LEARNING_SPINE_CATALOG.length, 32);
});

test("each lesson has >=3 prompt chips and privacy verification", () => {
  for (const lesson of AI_LEARNING_SPINE_CATALOG) {
    assert.ok(lesson.promptChips.length >= 3);
    assert.ok(lesson.verificationItems.some((i) => i.kind === "privacy"));
    assert.equal(lesson.publishScopeDefault, DEFAULT_PUBLISH_SCOPE);
    const domains = new Set(lesson.teacherRubricHints.map((hint) => hint.domain));
    for (const domain of TEACHER_RUBRIC_DOMAINS) assert.ok(domains.has(domain));
  }
});

test("store is SSR-safe and returns fallback on missing storage", () => {
  const draft = getAiLearningSpineDraft(1);
  assert.equal(draft.publishScope, "class_only");
});


test("corrupt localStorage data falls back safely", () => {
  const g = globalThis as unknown as { window?: any };
  g.window = { localStorage: { getItem: () => "{bad", setItem: () => undefined } };
  const draft = getAiLearningSpineDraft(2);
  assert.equal(draft.publishScope, "class_only");
  delete g.window;
});

test("store persistence excludes rawPrompt and keeps minimal draft fields", () => {
  let savedRaw = "";
  const g = globalThis as unknown as { window?: any };
  g.window = {
    localStorage: {
      getItem: () => null,
      setItem: (_key: string, value: string) => { savedRaw = value; },
    },
  };
  saveAiLearningSpineDraft({
    lessonNumber: 1,
    publishScope: "class_only",
    verificationState: { "l1-privacy": true },
    selectedChipIds: ["l1-easy"],
    evidence: { promptSummary: "summary", redactedPrompt: "[redacted]" },
  } as any);
  assert.doesNotMatch(savedRaw, /rawPrompt/i);
  assert.match(savedRaw, /selectedChipIds/);
  delete g.window;
});

test("publish defaults remain conservative and lesson fallback is safe", () => {
  const draft = getAiLearningSpineDraft(99);
  assert.equal(draft.publishScope, "class_only");
  assert.equal(getAiLearningSpineByLesson(999), null);
  assert.notEqual(draft.publishScope, "public_portfolio");
});
