import assert from "node:assert/strict";
import test from "node:test";

import { buildLocalPreviewDocument, type ManualFile } from "../app/dashboard/boards/[boardId]/board/_components/studentAppLocalPreview";

test("inlines relative css and js", () => {
  const files: ManualFile[] = [
    { name: "index.html", path: "index.html", contentText: '<html><head><link href="styles/app.css"></head><body><script src="scripts/app.js"></script></body></html>' },
    { name: "app.css", path: "styles/app.css", contentText: "body{color:red}" },
    { name: "app.js", path: "scripts/app.js", contentText: "console.log(1)" },
  ];
  const built = buildLocalPreviewDocument(files);
  assert.ok(built);
  assert.match(built.html, /<style data-inlined-from="styles\/app\.css">/);
  assert.match(built.html, /<script data-inlined-from="scripts\/app\.js">/);
});

test("img src assets/icon.svg and ./assets/icon.svg resolve", () => {
  const files: ManualFile[] = [
    { name: "index.html", path: "index.html", contentText: '<img src="assets/icon.svg"><img src="./assets/icon.svg">' },
    { name: "icon.svg", path: "assets/icon.svg", contentText: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', contentType: "image/svg+xml" },
  ];
  const built = buildLocalPreviewDocument(files);
  assert.ok(built);
  assert.match(built.html, /data:image\/svg\+xml;charset=utf-8,/);
});

test("css url assets and parent-relative assets resolve", () => {
  const files: ManualFile[] = [
    { name: "index.html", path: "index.html", contentText: '<html><head><link href="styles/app.css"></head><body></body></html>' },
    { name: "app.css", path: "styles/app.css", contentText: '.a{background:url("../assets/icon.svg")} .b{background:url("assets/icon.svg")}' },
    { name: "icon.svg", path: "assets/icon.svg", contentText: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', contentType: "image/svg+xml" },
  ];
  const built = buildLocalPreviewDocument(files);
  assert.ok(built);
  assert.match(built.html, /data:image\/svg\+xml;charset=utf-8,/);
});

test("missing asset emits warning and keeps CSP", () => {
  const built = buildLocalPreviewDocument([{ name: "index.html", path: "index.html", contentText: '<html><head><link href="x.css"></head><body><img src="missing.png"></body></html>' }]);
  assert.ok(built);
  assert.equal(built.warnings[0], "일부 연결 파일을 미리보기에 넣지 못했습니다.");
  assert.match(built.html, /img-src data: blob:/);
  assert.match(built.html, /connect-src 'none'/);
  assert.match(built.html, /form-action 'none'/);
  assert.doesNotMatch(built.html, /allow-same-origin/);
});
