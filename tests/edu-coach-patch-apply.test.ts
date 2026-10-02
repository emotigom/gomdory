import assert from "node:assert/strict";
import test from "node:test";

import { applyCoachPatchPayload } from "@/lib/edu/templates/applyCoachPatch";

test("applyCoachPatchPayload applies replace commands and blocks script/import", () => {
  const files = {
    "index.html": { contentType: "text/html" as const, content: "<html><body><h1>Hello</h1></body></html>" },
    "style.css": { contentType: "text/css" as const, content: "h1{color:red;}" },
  };

  const result = applyCoachPatchPayload(files, {
    htmlPatch: [
      { op: "replace", find: "Hello", replace: "Hi" },
      { op: "replace", find: "</body>", replace: "<script>alert(1)</script></body>" },
    ],
    cssPatch: "@import url('https://evil'); h1{color:blue;}",
  });

  assert.equal(result.changed, true);
  assert.ok(result.files["index.html"]?.content.includes("Hi"));
  assert.ok(!result.files["index.html"]?.content.includes("<script"));
  assert.ok(!result.files["style.css"]?.content.includes("@import"));
  assert.ok(result.warnings.includes("html_script_removed"));
  assert.ok(result.warnings.includes("css_import_removed"));
});
