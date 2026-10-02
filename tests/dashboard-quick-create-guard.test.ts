import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("dashboard quick create flow avoids absolute overlay and keeps markers", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "_components", "DashboardHomeCardsV1.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(content, /data-ui-marker="dashboard-quick-create"/);
  assert.match(content, /data-testid="dashboard-quick-create-drawer"/);
  assert.match(content, /data-ui-marker="dashboard-quick-create-failure"/);
  assert.doesNotMatch(content, /\babsolute\b/);
  assert.doesNotMatch(content, /\bfixed\b/);
});
