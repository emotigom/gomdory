import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublishFilesForCommit } from "@/lib/edu/publish/commitFileResolution";
import { validateEduPublishFiles } from "@/lib/edu/validateFiles";

test("validateEduPublishFiles accepts files packaged under a single top-level directory", () => {
  const result = validateEduPublishFiles([
    { path: "lesson/index.html", contentType: "text/html", sizeBytes: 120 },
    { path: "lesson/style.css", contentType: "text/css", sizeBytes: 42 },
  ]);

  assert.equal(result.ok, true);
});



test("validateEduPublishFiles allows empty optional assets like script.js", () => {
  const result = validateEduPublishFiles([
    { path: "index.html", contentType: "text/html", sizeBytes: 35031 },
    { path: "script.js", contentType: "text/javascript", sizeBytes: 0 },
  ]);

  assert.equal(result.ok, true);
});
test("resolvePublishFilesForCommit maps required files to a single top-level directory", () => {
  const validation = validateEduPublishFiles([
    { path: "index.html", contentType: "text/html", sizeBytes: 80 },
    { path: "style.css", contentType: "text/css", sizeBytes: 33 },
  ]);
  assert.equal(validation.ok, true);

  const resolved = resolvePublishFilesForCommit({
    files: validation.normalized,
    relativeObjectKeys: ["bundle/index.html", "bundle/style.css"],
  });

  assert.ok(resolved.resolved);
  assert.deepEqual(
    resolved.resolved?.map((file) => file.actualPath),
    ["bundle/index.html", "bundle/style.css"],
  );
});

test("resolvePublishFilesForCommit resolves index.html with casing differences", () => {
  const validation = validateEduPublishFiles([
    { path: "index.html", contentType: "text/html", sizeBytes: 100 },
  ]);
  assert.equal(validation.ok, true);

  const resolved = resolvePublishFilesForCommit({
    files: validation.normalized,
    relativeObjectKeys: ["Index.html"],
  });

  assert.ok(resolved.resolved);
  assert.equal(resolved.resolved?.[0]?.actualPath, "Index.html");
});

test("resolvePublishFilesForCommit returns FILE_MISSING-friendly listing metadata when unresolved", () => {
  const validation = validateEduPublishFiles([
    { path: "index.html", contentType: "text/html", sizeBytes: 100 },
    { path: "style.css", contentType: "text/css", sizeBytes: 50 },
  ]);
  assert.equal(validation.ok, true);

  const resolved = resolvePublishFilesForCommit({
    files: validation.normalized,
    relativeObjectKeys: ["assets/app.js", "assets/reset.css", "readme.txt"],
  });

  assert.equal(resolved.resolved, null);
  assert.deepEqual(resolved.debug.topLevelEntries, ["assets/", "readme.txt"]);
  assert.deepEqual(resolved.debug.detectedRootPaths, [""]);
  assert.deepEqual(resolved.debug.sampleFiles, ["assets/app.js", "assets/reset.css", "readme.txt"]);
});
