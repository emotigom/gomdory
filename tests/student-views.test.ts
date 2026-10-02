import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveSharedBoardView } from "@/lib/boards/resolveSharedBoardView";
import { updateViewSearchParams } from "@/app/s/[code]/_legacy/ViewSwitcher";

test("student board page exposes marker with wall view default", () => {
  const clientPath = path.join(
    process.cwd(),
    "app",
    "s",
    "[code]",
    "_legacy",
    "StudentBoardClient.tsx",
  );
  const content = fs.readFileSync(clientPath, "utf8");
  assert.ok(content.includes('data-page-marker="student-board"'));
  assert.ok(content.includes('view ?? "wall"'));
});

test("student board resolves columns view from query", () => {
  const resolved = resolveSharedBoardView("columns", null);
  assert.equal(resolved, "columns");
});

test("view switcher update changes view query param", () => {
  const params = new URLSearchParams("view=wall&tv=1");
  const next = updateViewSearchParams(params, "columns");
  assert.equal(next.get("view"), "columns");
  assert.equal(next.get("tv"), "1");
});
