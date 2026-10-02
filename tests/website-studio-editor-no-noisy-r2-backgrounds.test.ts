import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("active panels do not depend on R2 panel backgrounds", () => {
  const source = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioGlassSurface.tsx", "utf8");
  assert.doesNotMatch(source, /cardPanel/);
  assert.doesNotMatch(source, /editorPanel/);
  assert.doesNotMatch(source, /previewFrame/);
  assert.match(source, /pointer-events-none/);
  assert.match(source, /aria-hidden="true"/);
});
