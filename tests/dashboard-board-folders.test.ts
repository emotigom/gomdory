import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DASHBOARD_FOLDERS,
  filterBoardsByFolder,
  normalizeBoardFolderMap,
  normalizeFolders,
} from "@/app/dashboard/boardFolders";

test("normalize folders/map keep valid entries with defaults", () => {
  const folders = normalizeFolders([
    { id: "class", name: "수업" },
    { id: "", name: "invalid" },
    { id: "class", name: "dup" },
    { id: "personal", name: "개인" },
  ]);

  assert.deepEqual(folders, [
    { id: "class", name: "수업" },
    { id: "personal", name: "개인" },
  ]);

  const map = normalizeBoardFolderMap({ a: "class", b: "unknown", c: 123 }, folders);
  assert.deepEqual(map, { a: "class" });

  const fallbackFolders = normalizeFolders(null);
  assert.deepEqual(fallbackFolders, DEFAULT_DASHBOARD_FOLDERS);
});

test("folder filter narrows board list", () => {
  const boards = [
    { boardId: "a", title: "A" },
    { boardId: "b", title: "B" },
    { boardId: "c", title: "C" },
  ];
  const map = { a: "class", b: "personal" };

  assert.equal(filterBoardsByFolder(boards, "all", map).length, 3);
  assert.deepEqual(
    filterBoardsByFolder(boards, "class", map).map((board) => board.boardId),
    ["a"],
  );
});
