import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY01_ROLE_CARDS } from '@/lib/edu/courseware/lessonRuntime/day01AiBingoRuntime';

test('role cards cover all buckets with responsibility feedback',()=>{
  const buckets = new Set(DAY01_ROLE_CARDS.map((c)=>c.correctBucket));
  assert.deepEqual([...buckets].sort(), ['ai_first','human_ai_together','human_first']);
  const merged = DAY01_ROLE_CARDS.map((c)=>`${c.explanation} ${c.safetyNote}`).join(' ');
  for (const token of ['책임','개인정보','공정성','출처']) assert.ok(merged.includes(token));
});
