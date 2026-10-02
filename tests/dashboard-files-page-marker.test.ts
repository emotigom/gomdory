import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("dashboard files page exposes page marker", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "boards", "[boardId]", "files", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes('data-page-marker="dashboard-files"'));
});
