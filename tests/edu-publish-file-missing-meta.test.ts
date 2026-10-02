import assert from "node:assert/strict";
import test from "node:test";

import { fileMissingExtra } from "@/lib/edu/publish/fileMissingDiagnostics";

test("file missing diagnostics include checked key, target metadata, and bounded prefix sample", () => {
  const result = fileMissingExtra({
    path: "index.html",
    actualPath: "index.html",
    slug: "slug-base",
    slugPrefix: "edu/v1/slug-base/",
    checkedKey: "edu/v1/slug-base/index.html",
    bucketName: "gom-edu-projects",
    r2TargetKind: "rest",
    endpoint: "https://abc123.r2.cloudflarestorage.com",
    accountId: "abc123",
    prefixListingCount: 34,
    prefixSample: Array.from({ length: 30 }, (_, i) => `assets/file-${i + 1}.txt`).slice(0, 20),
  });

  assert.equal(result.slug, "slug-base");
  assert.equal(result.checkedKey, "edu/v1/slug-base/index.html");
  assert.equal(result.bucketName, "gom-edu-projects");
  assert.equal(result.r2TargetKind, "rest");
  assert.equal(result.endpoint, "https://abc123.r2.cloudflarestorage.com");
  assert.equal(result.accountId, "abc123");
  assert.equal(result.prefix, "edu/v1/slug-base/");
  assert.equal(result.prefixListingCount, 34);
  assert.equal(Array.isArray(result.prefixSample), true);
  assert.equal((result.prefixSample as string[]).length, 20);
});

test("file missing diagnostics preserve existing debug listing metadata", () => {
  const result = fileMissingExtra({
    path: "index.html",
    actualPath: "index.html",
    slug: "slug-base",
    slugPrefix: "edu/v1/slug-base/",
    checkedKey: "edu/v1/slug-base/index.html",
    bucketName: "gom-edu-projects",
    r2TargetKind: "rest",
    endpoint: "https://abc123.r2.cloudflarestorage.com",
    accountId: "abc123",
    prefixListingCount: 3,
    prefixSample: ["assets/app.js", "assets/reset.css", "readme.txt"],
    debugListing: {
      topLevelEntries: ["assets/", "readme.txt"],
      sampleFiles: ["assets/app.js", "assets/reset.css", "readme.txt"],
      detectedRootPaths: [],
    },
  });

  assert.deepEqual(result.topLevelEntries, ["assets/", "readme.txt"]);
  assert.deepEqual(result.sampleFiles, ["assets/app.js", "assets/reset.css", "readme.txt"]);
});
