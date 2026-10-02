import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("app/s/[code]/_components/StudentBoardMinimal.tsx", "utf8");

test("student top action dock stays compact and wired", () => {
  assert.match(board, /StudentAppSubmitPanel/);
  assert.match(board, /StudentAppGalleryPanel/);
  assert.match(board, /boardId=\{boardId\}/);
  assert.match(board, /shareCode=\{shareCode\}/);
  assert.match(board, /w-fit/);
  assert.match(board, /max-w-\[min\(920px,calc\(100vw-32px\)\)\]/);
  assert.match(board, /max-w-\[calc\(100vw-24px\)\]/);
  assert.match(board, /pointer-events-none/);
  assert.match(board, /pointer-events-auto/);
  assert.match(board, /카드를 작성할 수 있어요/);
  assert.doesNotMatch(board, /<span[^>]*>\s*\{writeLocked \? writeLockedMessage : "카드를 작성할 수 있어요"\}\s*<\/span>\s*<StudentAppSubmitPanel/s);
  const tools = board.match(/<div\s+data-student-topbar-section="tools"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.match(tools, /flex min-h-11 items-center gap-2/);
  assert.match(tools, /<StudentAppSubmitPanel boardId=\{boardId\} shareCode=\{shareCode\}/);
  assert.match(tools, /<StudentAppGalleryPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="button"/);
  assert.match(board, /<StudentAppSubmitPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="modal-host"/);
  assert.match(board, /<StudentAppGalleryPanel boardId=\{boardId\} shareCode=\{shareCode\} displayMode="modal-host"/);
});
