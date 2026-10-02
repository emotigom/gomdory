import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY01_LESSON_RUNTIME } from '@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog';

test('day01 includes required blocks and korean instructions', () => {
  const kinds = DAY01_LESSON_RUNTIME.blocks.map((b) => b.kind);
  for (const required of ['warmup','concept_card','prompt_lab','code_lab','verification_checklist','evidence_log','exit_ticket']) assert.ok(kinds.includes(required as never));
  DAY01_LESSON_RUNTIME.blocks.filter((b) => b.required).forEach((b) => assert.ok(/[가-힣]/.test(b.studentInstructions)));
});
