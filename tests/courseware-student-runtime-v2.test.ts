import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { progressKey, clampStage, STUDENT_DAY_RUNTIME_MARKER } from '@/lib/edu/courseware/studentCoursewareFlow';
import { STUDENT_DAY_CONTENT } from '@/lib/edu/courseware/studentCoursewareContent';
import { getManifestAssetCount, getVisualForDayScene, validateDecorativeAssetHosts } from '@/lib/edu/courseware/coursewareVisualManifest';

test('day 1-16 completeness contract', () => {
  assert.equal(STUDENT_DAY_RUNTIME_MARKER, 'student-day-v2');
  assert.equal(STUDENT_DAY_CONTENT.length, 16);
  for (const day of STUDENT_DAY_CONTENT) {
    const types = day.scenes.map((scene) => scene.type);
    for (const required of ['intro','story','theory','interaction','notebook','reflection','completion']) {
      assert.ok(types.includes(required as any), `day ${day.day} missing ${required}`);
    }
    const notebookScene = day.scenes.find((scene) => scene.type === 'notebook');
    assert.ok(notebookScene);
    assert.ok(notebookScene?.notebook?.introMarkdown?.trim().length);
    assert.ok(notebookScene?.notebook?.starterCode?.trim().length);
    assert.ok(notebookScene?.notebook?.expectedOutput?.trim().length);
  }
});

test('progress versioning and clamp', () => {
  assert.ok(progressKey(1, 'v4').includes('day:1'));
  assert.equal(clampStage(99, 7), 0);
});

test('manifest integration + fallback + allowed domain', () => {
  assert.ok(getManifestAssetCount() >= 1);
  assert.equal(validateDecorativeAssetHosts(), true);
  const known = getVisualForDayScene(10, 'notebook');
  assert.ok(known.fallbackGradient.includes('gradient'));
  const fallback = getVisualForDayScene(3, 'story');
  assert.ok(fallback.key.length > 0);
});

test('student runtime notebook controls are real and local-only', () => {
  const source = fs.readFileSync('app/edu/lesson/day/[day]/StudentLessonRuntimeClient.tsx', 'utf8');
  assert.match(source, /handleCopyCode/);
  assert.match(source, /navigator\.clipboard\?\.writeText/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-expanded=\{isOutputOpen\}/);
  assert.match(source, /예시 결과 보기/);
  assert.match(source, /예시 결과 숨기기/);
  assert.match(source, /setNotebookDraft/);
  assert.match(source, /서버로 전송되지 않습니다/);
  assert.match(source, /pointer-events-none/);
  assert.match(source, /localStorage/);
  assert.doesNotMatch(source, /fetch\(/);
});
