import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValidationInputFromNormalizedFiles,
  inferStudentAppTitleFromFiles,
  normalizeStudentAppFiles,
} from "@/lib/student-apps/staticAppIntake";
import { validateStudentStaticApp } from "@/lib/student-apps/staticAppValidator";

test("normalizes simple files with name only", () => {
  const result = normalizeStudentAppFiles({
    files: [
      { name: "index.html", content: "<html></html>" },
      { name: "style.css", content: "body{}" },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.files.map((f) => f.path), ["index.html", "style.css"]);
});

test("preserves nested assets", () => {
  const result = normalizeStudentAppFiles({
    files: [{ name: "logo.png", path: "my-app/assets/logo.png", content: new Uint8Array([1]) }],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.files.map((f) => f.path), ["assets/logo.png"]);
});

test("strips a single common root folder", () => {
  const result = normalizeStudentAppFiles({
    files: [
      { name: "index.html", path: "my-app/index.html", content: "ok" },
      { name: "style.css", path: "my-app/style.css", content: "ok" },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.files.map((f) => f.path), ["index.html", "style.css"]);
});

test("does not strip root when mixed roots exist", () => {
  const result = normalizeStudentAppFiles({
    files: [
      { name: "index.html", path: "my-app/index.html", content: "ok" },
      { name: "other.css", path: "style.css", content: "ok" },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.files.map((f) => f.path), ["my-app/index.html", "style.css"]);
});

test("drops __MACOSX and .DS_Store with warning", () => {
  const result = normalizeStudentAppFiles({
    files: [
      { name: "index.html", content: "ok" },
      { name: "x", path: "__MACOSX/file", content: "ignore" },
      { name: ".DS_Store", content: "ignore" },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.files.length, 1);
  assert.equal(result.warnings.length, 2);
});

test("drops directory placeholder entries with warning", () => {
  const result = normalizeStudentAppFiles({
    files: [
      { name: "index.html", content: "ok" },
      { name: "dir", path: "my-app/", content: "" },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.files.length, 1);
  assert.match(result.warnings.join(","), /ignored_directory_placeholder/);
});

test("rejects duplicate normalized paths", () => {
  const result = normalizeStudentAppFiles({
    files: [
      { name: "a", path: "app/index.html", content: "1" },
      { name: "b", path: "app\\index.html", content: "2" },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /duplicate_path:index\.html/);
});

test("rejects empty final path", () => {
  const result = normalizeStudentAppFiles({
    files: [{ name: "my-app", path: "my-app", content: "x" }],
    rootFolderName: "my-app",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /empty_final_path/);
});

test("infers title from index.html <title>", () => {
  const title = inferStudentAppTitleFromFiles([{ path: "index.html", content: "<title> Demo App </title>" }]);
  assert.equal(title, "Demo App");
});

test("strips tags from title", () => {
  const title = inferStudentAppTitleFromFiles([{ path: "index.html", content: "<title><b>Bold</b> Name</title>" }]);
  assert.equal(title, "Bold Name");
});

test("limits title length", () => {
  const long = "a".repeat(120);
  const title = inferStudentAppTitleFromFiles([{ path: "index.html", content: `<title>${long}</title>` }]);
  assert.equal(title.length, 80);
});

test("buildValidationInputFromNormalizedFiles works with validateStudentStaticApp", async () => {
  const normalized = normalizeStudentAppFiles({ files: [{ name: "index.html", content: "<title>A</title>" }] });
  assert.equal(normalized.ok, true);
  const input = buildValidationInputFromNormalizedFiles({ files: normalized.files, source: "manual_files" });
  const result = await validateStudentStaticApp(input);
  assert.equal(result.ok, true);
});

test("manual files can be normalized and then accepted by validator", async () => {
  const normalized = normalizeStudentAppFiles({
    files: [
      { name: "index.html", path: "build/index.html", content: "<html></html>" },
      { name: "main.js", path: "build/main.js", content: "console.log(1)" },
    ],
  });
  assert.equal(normalized.ok, true);
  const result = await validateStudentStaticApp(
    buildValidationInputFromNormalizedFiles({ files: normalized.files, title: "Demo", source: "manual_files" }),
  );
  assert.equal(result.ok, true);
});

test("missing index.html is caught by validateStudentStaticApp", async () => {
  const normalized = normalizeStudentAppFiles({ files: [{ name: "main.js", content: "console.log(1)" }] });
  assert.equal(normalized.ok, true);
  const result = await validateStudentStaticApp(
    buildValidationInputFromNormalizedFiles({ files: normalized.files, source: "manual_files" }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /missing_index_html/);
});
