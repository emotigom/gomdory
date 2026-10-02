import assert from "node:assert/strict";
import test from "node:test";

import { filterBoardsByQuery } from "@/lib/dashboard/filterBoardsByQuery";

const boards = [
  { id: "1", title: "Math Class" },
  { id: "2", title: "과학 토론 보드" },
  { id: "3", title: "  Korean   Space  " },
  { id: "4", title: "영어 발표" },
];

test("returns original list when query is empty after normalization", () => {
  assert.equal(filterBoardsByQuery(boards, "   \n  "), boards);
});

test("filters by case-insensitive english substring", () => {
  const result = filterBoardsByQuery(boards, "mAtH");
  assert.deepEqual(result.map((board) => board.id), ["1"]);
});

test("filters by korean substring", () => {
  const result = filterBoardsByQuery(boards, "토론");
  assert.deepEqual(result.map((board) => board.id), ["2"]);
});

test("normalizes consecutive spaces in query and title", () => {
  const result = filterBoardsByQuery(boards, "korean space");
  assert.deepEqual(result.map((board) => board.id), ["3"]);
});
