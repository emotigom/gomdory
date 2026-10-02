import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("public report page includes marker attribute", () => {
  const filePath = path.join(process.cwd(), "app", "r", "[token]", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  assert.ok(
    content.includes('data-page-marker="public-session-report"'),
    "page marker attribute should be present for public report",
  );
});
