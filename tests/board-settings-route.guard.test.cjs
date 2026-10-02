const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...parts) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

test('board settings page links back to canonical /board and not class/grid', () => {
  const page = read('app', 'dashboard', 'boards', '[boardId]', 'edit', 'page.tsx');
  assert.match(page, /boardBoardHref/);
  assert.match(page, /보드로 돌아가기/);
  assert.doesNotMatch(page, /\/class|\/grid/);
});

test('board settings route avoids legacy runtime and drag/wheel patterns', () => {
  const page = read('app', 'dashboard', 'boards', '[boardId]', 'edit', 'page.tsx');
  assert.doesNotMatch(page, /TeacherBoardMinimalClient|WallColumn|TeacherGridBoard/);
  assert.doesNotMatch(page, /wheelRouting|dragScroll|DndContext|DragOverlay/);
});

test('board settings action uses existing updateBoard action and owner-scoped auth', () => {
  const actions = read('app', 'dashboard', 'boards', '[boardId]', 'edit', 'actions.ts');
  assert.match(actions, /requireUser\(`/);
  assert.match(actions, /updateBoard\(/);
  assert.match(actions, /ownerId:\s*user\.id/);
  assert.match(actions, /redirect\(boardBoardHref\(normalizedBoardId\)\)/);
});
