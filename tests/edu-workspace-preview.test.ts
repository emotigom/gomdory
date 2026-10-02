import assert from "node:assert/strict";
import test from "node:test";

import { buildPreviewDoc, type WorkspaceFile } from "@/app/edu/_components/Workspace";

const makeFiles = (overrides: Partial<Record<string, WorkspaceFile>>) => ({
  "index.html": {
    content: "<!doctype html><html><head></head><body><h1>Hello</h1></body></html>",
    contentType: "text/html",
  },
  "style.css": { content: "body{color:tomato;}", contentType: "text/css" },
  "script.js": { content: "console.log('hi')", contentType: "text/javascript" },
  ...overrides,
});

test("buildPreviewDoc injects css and js into html shell", () => {
  const doc = buildPreviewDoc(makeFiles({}));
  assert.match(doc, /<style>body\{color:tomato;\}<\/style><\/head>/);
  assert.match(doc, /<script>console\.log\('hi'\)<\/script><\/body>/);
});

test("buildPreviewDoc handles missing head/body tags", () => {
  const files = makeFiles({
    "index.html": { content: "<div>Just content</div>", contentType: "text/html" },
  });
  const doc = buildPreviewDoc(files);
  assert.ok(doc.startsWith("<style>body{color:tomato;}</style>"));
  assert.ok(doc.endsWith("<script>console.log('hi')</script>"));
});

test("buildPreviewDoc falls back to main.js when script.js is missing", () => {
  const files = makeFiles({
    "script.js": undefined,
    "main.js": { content: "console.log('fallback')", contentType: "text/javascript" },
  });
  const doc = buildPreviewDoc(files);
  assert.match(doc, /<script>console\.log\('fallback'\)<\/script><\/body>/);
});


test("buildPreviewDoc removes local file refs and keeps inline assets", () => {
  const files = makeFiles({
    "index.html": {
      content: `<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Hello</h1><script src="script.js" defer></script></body></html>`,
      contentType: "text/html",
    },
  });

  const doc = buildPreviewDoc(files);
  assert.doesNotMatch(doc, /src="script\.js"/);
  assert.doesNotMatch(doc, /href="style\.css"/);
  assert.match(doc, /<style>body\{color:tomato;\}<\/style>/);
  assert.match(doc, /<script>console\.log\('hi'\)<\/script>/);
});
