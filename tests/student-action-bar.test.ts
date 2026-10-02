import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("student action bar exposes status labels", () => {
  const filePath = path.join(process.cwd(), "app", "s", "[code]", "_legacy", "StudentActionBar.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes('data-testid="student-action-status"'));
  assert.ok(content.includes("전송중"));
  assert.ok(content.includes("접수됨"));
});

test("student action bar includes locked copy", () => {
  const filePath = path.join(process.cwd(), "app", "s", "[code]", "_legacy", "StudentActionBar.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(content.includes("지금은 받지 않아요"));
});
