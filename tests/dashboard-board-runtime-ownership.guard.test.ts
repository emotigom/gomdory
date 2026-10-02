import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("board hub and legacy grid route both redirect to canonical /board route", () => {
  const boardHub = read("app", "dashboard", "boards", "[boardId]", "page.tsx");
  const gridRoute = read("app", "dashboard", "boards", "[boardId]", "grid", "page.tsx");

  assert.match(boardHub, /redirect\(boardHref\)/);
  assert.match(boardHub, /const boardHref = normalizeHref\(boardBoardHref\(boardId\)\)/);
  assert.match(gridRoute, /redirect\(`\/dashboard\/boards\/\$\{boardId\}\/board`\)/);
});

test("canonical board route owns runtime and class route redirects", () => {
  const boardPage = read("app", "dashboard", "boards", "[boardId]", "board", "page.tsx");
  const classPage = read("app", "dashboard", "boards", "[boardId]", "class", "page.tsx");

  assert.match(boardPage, /import TeacherBoardCanonicalClient from "\.\/TeacherBoardCanonicalClient"/);
  assert.match(classPage, /redirect\(`\/dashboard\/boards\/\$\{boardId\}\/board`\)/);
});
