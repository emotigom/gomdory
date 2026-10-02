import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeGeneratedFiles,
  sanitizeIndexHtml,
  sanitizeScriptJs,
} from "@/lib/edu/files/sanitizeGeneratedFiles";

test("sanitizeIndexHtml strips external scripts, links, iframes, and refresh", () => {
  const html = `<!doctype html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url=https://example.com">
    <link rel="stylesheet" href="https://cdn.example.com/reset.css">
  </head>
  <body>
    <iframe src="https://example.com/embed"></iframe>
    <script src="http://cdn.example.com/app.js"></script>
  </body>
</html>`;
  const result = sanitizeIndexHtml(html).sanitized;

  assert.equal(result.includes("http://cdn.example.com"), false);
  assert.equal(result.includes("https://cdn.example.com"), false);
  assert.equal(result.includes("<iframe"), false);
  assert.equal(result.includes("http-equiv=\"refresh\""), false);
});

test("sanitizeScriptJs disables while(true) loops and throttles extra intervals", () => {
  const js = `while(true){console.log('x');}
setInterval(() => console.log('a'), 1000);
setInterval(() => console.log('b'), 2000);`;
  const result = sanitizeScriptJs(js);

  assert.equal(result.sanitized.includes("while (false"), true);
  assert.equal(result.sanitized.match(/setInterval\s*\(/g)?.length, 1);
  assert.equal(result.sanitized.includes("setTimeout("), true);
  assert.ok(result.warnings.includes("infinite-loop"));
  assert.ok(result.warnings.includes("interval-spam"));
});

test("sanitizeGeneratedFiles reports warnings for risky patterns", () => {
  const result = sanitizeGeneratedFiles({
    "script.js": {
      content: "while(true){}\nsetInterval(() => {}, 1000);\nsetInterval(() => {}, 2000);",
      contentType: "text/javascript",
    },
  });

  assert.ok(result.warnings.includes("infinite-loop"));
  assert.ok(result.warnings.includes("interval-spam"));
});
