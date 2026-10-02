import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("website studio shell includes glass theme markers", () => {
  const source = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioShell.tsx", "utf8");
  assert.match(source, /data-website-studio-theme="glass"/);
  assert.match(source, /data-website-studio-runtime/);
});
