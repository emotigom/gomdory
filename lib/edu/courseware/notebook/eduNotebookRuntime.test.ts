import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDENT_DAY_CONTENT } from '@/lib/edu/courseware/studentCoursewareContent';
import { EduNotebookRunner } from '@/lib/edu/courseware/notebook/eduNotebookRunner';

test('day 1-16 notebook fields are complete', () => {
  const days = STUDENT_DAY_CONTENT.filter((d) => d.day >= 1 && d.day <= 16);
  assert.equal(days.length, 16);
  for (const day of days) {
    const notebook = day.scenes.find((s) => s.type === 'notebook')?.notebook;
    assert.ok(notebook?.starterCode);
    assert.ok(notebook?.expectedOutput);
    assert.ok(notebook?.contentVersion);
  }
});

test('runner fallback returns local-only friendly error when execution disabled', async () => {
  const runner = new EduNotebookRunner();
  const result = await runner.runCode('print("hello")');
  assert.equal(typeof result.status, 'string');
  if (!runner.isExecutionAvailable()) {
    assert.equal(result.status, 'error');
    assert.ok(result.error?.includes('브라우저'));
  }
});
