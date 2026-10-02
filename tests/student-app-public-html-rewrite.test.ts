import assert from "node:assert/strict";
import test from "node:test";

import { rewritePublishedStudentAppHtmlAssetUrls } from "@/lib/student-apps/rewritePublishedStudentAppHtml";

test("rewrites safe relative src/href URLs to deployment-scoped absolute paths", () => {
  const input = [
    '<link rel="stylesheet" href="styles/app.css">',
    '<script src="scripts/app.js"></script>',
    '<img src="assets/bear.svg">',
    '<link href="./styles/app.css">',
  ].join("\n");

  const out = rewritePublishedStudentAppHtmlAssetUrls(input, "id");

  assert.match(out, /href="\/apps\/id\/styles\/app\.css"/);
  assert.match(out, /src="\/apps\/id\/scripts\/app\.js"/);
  assert.match(out, /src="\/apps\/id\/assets\/bear\.svg"/);
  assert.match(out, /href="\/apps\/id\/styles\/app\.css"/);
});

test("does not rewrite absolute, special, anchored, or already scoped URLs", () => {
  const input = [
    '<link href="/absolute/path.css">',
    '<script src="https://example.com/x.js"></script>',
    '<img src="data:image/svg+xml;base64,aaa">',
    '<img src="blob:https://example.com/x">',
    '<a href="#anchor">go</a>',
    '<a href="javascript:alert(1)">x</a>',
    '<link href="/apps/id/styles/app.css">',
  ].join("\n");

  const out = rewritePublishedStudentAppHtmlAssetUrls(input, "id");

  assert.match(out, /href="\/absolute\/path\.css"/);
  assert.match(out, /src="https:\/\/example\.com\/x\.js"/);
  assert.match(out, /src="data:image\/svg\+xml;base64,aaa"/);
  assert.match(out, /src="blob:https:\/\/example\.com\/x"/);
  assert.match(out, /href="#anchor"/);
  assert.match(out, /href="javascript:alert\(1\)"/);
  assert.match(out, /href="\/apps\/id\/styles\/app\.css"/);
});
