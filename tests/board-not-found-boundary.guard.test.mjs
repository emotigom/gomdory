import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "app/dashboard/boards/[boardId]/not-found.tsx",
  "utf8",
);

test("board not-found tolerates Next rendering the boundary without route params", () => {
  assert.match(source, /params\?: Promise<\{ boardId\?: string \}>/);
  assert.match(source, /const resolvedParams = params \? await params : null/);
  assert.match(source, /const boardId = resolvedParams\?\.boardId\?\.trim\(\) \?\? ""/);
  assert.doesNotMatch(source, /const \{ boardId \} = await params/);
  assert.match(source, /if \(boardId\) \{[\s\S]*requireUser/);
  assert.match(source, /if \(!boardId\) \{[\s\S]*redirect\("\/dashboard"\)/);
});
