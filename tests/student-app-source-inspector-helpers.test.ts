import assert from "node:assert/strict";
import test from "node:test";

import { buildSelectedFileSummary, buildSelectedManualFileSummary, toManualPath } from "../app/dashboard/boards/[boardId]/board/_components/studentAppSourceInspectorHelpers";

test("hasCommonRoot false for root-level files", () => {
  const summary = buildSelectedFileSummary([{ name: "index.html", size: 10 }, { name: "style.css", size: 20 }] as File[]);
  assert.equal(summary.hasCommonRoot, false);
});

test("hasCommonRoot true for same top folder", () => {
  const summary = buildSelectedFileSummary([{ name: "index.html", size: 10, webkitRelativePath: "my-app/index.html" }, { name: "style.css", size: 20, webkitRelativePath: "my-app/style.css" }] as unknown as File[]);
  assert.equal(summary.hasCommonRoot, true);
});

test("hasCommonRoot false for mixed roots", () => {
  const summary = buildSelectedFileSummary([{ name: "index.html", size: 10, webkitRelativePath: "my-app/index.html" }, { name: "style.css", size: 20, webkitRelativePath: "other/style.css" }] as unknown as File[]);
  assert.equal(summary.hasCommonRoot, false);
});

test("project source detection cases", () => {
  const srcOnly = buildSelectedFileSummary([{ name: "package.json", size: 1, webkitRelativePath: "a/package.json" }, { name: "main.tsx", size: 1, webkitRelativePath: "a/src/main.tsx" }] as unknown as File[]);
  assert.equal(srcOnly.hasProjectSourceSignals, true);
  const withIndex = buildSelectedFileSummary([{ name: "index.html", size: 1, webkitRelativePath: "a/index.html" }, { name: "package.json", size: 1, webkitRelativePath: "a/package.json" }] as unknown as File[]);
  assert.equal(withIndex.hasIndexHtml, false);
  assert.equal(withIndex.hasProjectSourceSignals, true);
});


test("buildSelectedManualFileSummary detects key signals", () => {
  const summary = buildSelectedManualFileSummary([{ name: "index.html", path: "my-app/index.html", contentText: "<html></html>" }, { name: "app.js", path: "my-app/app.js", contentText: "1" }]);
  assert.equal(summary.hasIndexHtml, false);
  assert.equal(summary.hasCommonRoot, true);

  const project = buildSelectedManualFileSummary([{ name: "package.json", path: "package.json", contentText: "{}" }, { name: "main.tsx", path: "src/main.tsx", contentText: "" }]);
  assert.equal(project.hasProjectSourceSignals, true);
  assert.equal(project.hasIndexHtml, false);
});

test("toManualPath handles File | ManualFile safely", () => {
  const fileLike = { name: "index.html", webkitRelativePath: "a/index.html" } as unknown as File;
  assert.equal(toManualPath(fileLike), "a/index.html");
  assert.equal(toManualPath({ name: "index.html", path: "b/index.html", contentText: "" }), "b/index.html");
});
