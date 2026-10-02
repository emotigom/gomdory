import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY01_LESSON_RUNTIME } from '@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog';
import { summarizeLessonVolume } from '@/lib/edu/courseware/lessonRuntime/lessonRuntimeSummary';
import { validateLessonRuntime } from '@/lib/edu/courseware/lessonRuntime/lessonRuntimeValidation';

test('day01 runtime minute range and validation', () => {
  const summary = summarizeLessonVolume(DAY01_LESSON_RUNTIME);
  assert.equal(summary.inRange40to50, true);
  assert.equal(summary.requiredCoverage, true);
  assert.deepEqual(validateLessonRuntime(DAY01_LESSON_RUNTIME), []);
});
