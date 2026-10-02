import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY01_EMPTY_PROGRESS, loadDay01Progress } from '@/lib/edu/courseware/lessonRuntime/day01AiBingoRuntime';

test('store is ssr safe and no identity fields',()=>{
  const loaded = loadDay01Progress();
  assert.deepEqual(loaded, DAY01_EMPTY_PROGRESS);
  const blob = JSON.stringify(DAY01_EMPTY_PROGRESS);
  for (const pii of ['email','phone','prompt','name']) assert.equal(blob.includes(pii), false);
});
