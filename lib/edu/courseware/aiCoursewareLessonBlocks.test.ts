import test from "node:test";
import assert from "node:assert/strict";
import { getCoursewareLessonBlocks } from "./aiCoursewareLessonBlocks";
import { isKnownCoursewareBlockType } from "../../../app/edu/lesson/_components/LessonBlockRenderer";

test('day 1 includes required interactive blocks', () => {
  const blocks = getCoursewareLessonBlocks(1);
  const types = new Set(blocks.map((b) => b.type));
  assert.equal(types.has('theoryCapsule'), true);
  assert.equal(types.has('interactiveSort'), true);
  assert.equal(types.has('promptLab'), true);
  assert.equal(types.has('webCardBuilder'), true);
  assert.equal(types.has('reflectionBuilder'), true);
});

test('block renderer supports known types and rejects unknown types safely', () => {
  assert.equal(isKnownCoursewareBlockType('theoryCapsule'), true);
  assert.equal(isKnownCoursewareBlockType('interactiveSort'), true);
  assert.equal(isKnownCoursewareBlockType('unknownType'), false);
});

test('day 9 does not default to day 1 blocks', () => {
  const blocks = getCoursewareLessonBlocks(9);
  const types = new Set(blocks.map((block) => block.type));

  assert.equal(blocks.length > 0, true);
  assert.equal(types.has('browserAiLab'), true);
  assert.equal(types.has('teachableMachineLab'), true);
  assert.equal(blocks.every((block) => block.id.startsWith('d9-')), true);
  assert.equal(blocks.some((block) => block.id.startsWith('d1-')), false);
});

test('unknown day returns no lesson blocks', () => {
  assert.deepEqual(getCoursewareLessonBlocks(999), []);
});
