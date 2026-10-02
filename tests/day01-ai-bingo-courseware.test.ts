import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY01_LESSON_RUNTIME } from '@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog';
import { DAY01_BINGO_ITEMS, DAY01_SITUATION_MISSIONS, countBingoLines } from '@/lib/edu/courseware/lessonRuntime/day01AiBingoRuntime';

test('day01 runtime has 45 minute coverage and required activities', () => {
  const total = DAY01_LESSON_RUNTIME.blocks.reduce((s,b)=>s+b.estimatedMinutes,0);
  assert.ok(total >= 40 && total <= 50);
  for (const id of ['bingo','classifier','role_sort','situations','result_card','exit','teacher']) assert.ok(DAY01_LESSON_RUNTIME.blocks.some((b)=>b.id===id));
});

test('bingo catalog includes ai and not-ai and line counting works', () => {
  assert.ok(DAY01_BINGO_ITEMS.some((i)=>i.isAiExample));
  assert.ok(DAY01_BINGO_ITEMS.some((i)=>!i.isAiExample));
  const firstRow = DAY01_BINGO_ITEMS.slice(0,4).map((i)=>i.id);
  assert.equal(countBingoLines(firstRow,4),1);
});

test('situation missions include human judgement focuses',()=>{
  const focuses = new Set(DAY01_SITUATION_MISSIONS.map((m)=>m.humanJudgementFocus));
  assert.ok(focuses.has('privacy'));
  assert.ok(focuses.has('fairness'));
  assert.ok(focuses.has('source_check'));
});
