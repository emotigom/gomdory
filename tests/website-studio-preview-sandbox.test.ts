import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("preview iframe keeps sandbox without allow-scripts", () => {
  const source = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioPreviewFrame.tsx", "utf8");
  assert.match(source, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(source, /allow-scripts/);
});
