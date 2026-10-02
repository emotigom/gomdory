import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

test("starter/editor defer local store access to useEffect", () => {
  const starter = fs.readFileSync("app/dashboard/websites/new/WebsiteStudioStarterClient.tsx", "utf8");
  const editor = fs.readFileSync("app/dashboard/websites/[siteId]/edit/WebsiteStudioEditorClient.tsx", "utf8");
  assert.match(starter, /useEffect\(\(\) => \{[\s\S]*listLocalWebsiteProjects\(\)/);
  assert.match(editor, /useEffect\(\(\) => \{[\s\S]*getLocalWebsiteProject\(siteId\)/);
});
