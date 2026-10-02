import assert from "node:assert/strict";
import test from "node:test";

import { buildPreviewHtml } from "@/lib/labs/buildPreviewHtml";

test("buildPreviewHtml includes CSS and JS in full HTML document", () => {
  const preview = buildPreviewHtml({
    html: "<main><h1>hello</h1></main>",
    css: "h1 { color: red; }",
    js: 'console.log("ok")',
  });

  assert.match(preview, /<meta charset="utf-8"\s*\/>/i);
  assert.match(preview, /h1 \{ color: red; \}/);
  assert.match(preview, /console\.log\("ok"\)/);
});

test("buildPreviewHtml always emits script tag even when JS is empty", () => {
  const preview = buildPreviewHtml({
    html: "<p>empty js</p>",
    css: "",
    js: "",
  });

  assert.match(preview, /<script>\s*[\s\S]*<\/script>/i);
});

