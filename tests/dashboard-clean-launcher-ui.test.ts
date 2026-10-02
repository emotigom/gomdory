import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("clean mode launcher panel marker exists", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "BoardList.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes('data-testid="clean-launcher-panel"'));
});
