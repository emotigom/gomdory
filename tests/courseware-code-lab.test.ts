import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY01_LESSON_RUNTIME } from '@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog';

test('code lab block has fallback and no-login safety', () => {
  const block = DAY01_LESSON_RUNTIME.blocks.find((b) => b.kind === 'code_lab');
  assert.ok(block);
  assert.equal(block?.fallbackAvailable, true);
  assert.equal(block?.supportsNoLogin, true);
});
