import test from "node:test";
import assert from "node:assert/strict";

import { applyHtmlCssPatch, undoHistory, pushHistory, resetHistory } from "@/lib/edu/patch/applyHtmlCssPatch";

const baseFiles = {
  "index.html": { content: "<main><h1>Base</h1></main>", contentType: "text/html" as const },
  "style.css": { content: "body{margin:0;}", contentType: "text/css" as const },
  "script.js": { content: "", contentType: "text/javascript" as const },
};

test("applyHtmlCssPatch removes script tags and inline handlers", () => {
  const result = applyHtmlCssPatch({
    currentFiles: baseFiles,
    patch: {
      html: '<main onclick="alert(1)"><h1>Safe</h1><script>alert(1)</script></main>',
      css: "main{color:red;}",
    },
  });

  assert.equal(result.removedScripts, true);
  assert.match(result.files["index.html"].content, /<h1>Safe<\/h1>/);
  assert.doesNotMatch(result.files["index.html"].content, /<script/i);
  assert.doesNotMatch(result.files["index.html"].content, /onclick=/i);
  assert.equal(result.files["style.css"].content, "main{color:red;}");
});

test("patch history supports push/undo/reset", () => {
  const afterPatch = applyHtmlCssPatch({
    currentFiles: baseFiles,
    patch: { html: "<main><h1>Next</h1></main>" },
  }).files;

  const pushed = pushHistory({ past: [], present: baseFiles }, afterPatch);
  assert.equal(pushed.past.length, 1);
  assert.match(pushed.present["index.html"].content, /Next/);

  const undone = undoHistory(pushed);
  assert.equal(undone.past.length, 0);
  assert.match(undone.present["index.html"].content, /Base/);

  const reset = resetHistory(baseFiles);
  assert.equal(reset.past.length, 0);
  assert.match(reset.present["index.html"].content, /Base/);
});
