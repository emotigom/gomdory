import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeDeclaredPublishManifest,
  digestCanonicalPublishManifest,
  PublishManifestContractError,
  serializeCanonicalPublishManifest,
  type DeclaredPublishFile,
} from "@/lib/edu/publish/manifest";

const HTML_HASH = "a".repeat(64);
const JS_HASH = "b".repeat(64);
const CSS_HASH = "c".repeat(64);

const files: DeclaredPublishFile[] = [
  { path: "assets/style.css", sizeBytes: 12, contentType: "text/css", sha256: CSS_HASH },
  { path: "index.html", sizeBytes: 123, contentType: "text/html", sha256: HTML_HASH },
  { path: "assets/app.js", sizeBytes: 34, contentType: "text/javascript", sha256: JS_HASH },
];

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof PublishManifestContractError);
    return (error as PublishManifestContractError).code;
  }
  assert.fail("expected manifest contract error");
  return "";
}

test("canonical manifest has fixed schema, entry point, sorting, and serialization key order", async () => {
  const manifest = canonicalizeDeclaredPublishManifest(files);
  assert.deepEqual(manifest, {
    schemaVersion: 1,
    entryPoint: "index.html",
    files: [
      { path: "assets/app.js", sizeBytes: 34, contentType: "text/javascript", sha256: JS_HASH },
      { path: "assets/style.css", sizeBytes: 12, contentType: "text/css", sha256: CSS_HASH },
      { path: "index.html", sizeBytes: 123, contentType: "text/html", sha256: HTML_HASH },
    ],
  });
  assert.equal(serializeCanonicalPublishManifest(manifest), JSON.stringify(manifest));
  assert.equal(await digestCanonicalPublishManifest(manifest), "ecc9dc47af0c812335a9a0c5a0d38ccba3ff333c065549f13881ab21c700045d");
});

test("input order and object key order do not affect serialization or digest", async () => {
  const reordered = files.slice().reverse().map((file) => ({ sha256: file.sha256, contentType: file.contentType, path: file.path, sizeBytes: file.sizeBytes }));
  const first = canonicalizeDeclaredPublishManifest(files);
  const second = canonicalizeDeclaredPublishManifest(reordered);
  assert.equal(serializeCanonicalPublishManifest(first), serializeCanonicalPublishManifest(second));
  assert.equal(await digestCanonicalPublishManifest(first), await digestCanonicalPublishManifest(second));
});

test("NFC paths canonicalize to the same manifest", () => {
  const composed = canonicalizeDeclaredPublishManifest([{ ...files[0], path: "assets/café.css" }, files[1], files[2]]);
  const decomposed = canonicalizeDeclaredPublishManifest([{ ...files[0], path: "assets/café.css" }, files[1], files[2]]);
  assert.equal(serializeCanonicalPublishManifest(composed), serializeCanonicalPublishManifest(decomposed));
});

test("path, size, MIME, and declared hash changes change the digest", async () => {
  const base = canonicalizeDeclaredPublishManifest(files);
  for (const change of [
    { path: "assets/other.js" },
    { sizeBytes: 35 },
    { contentType: "application/javascript" },
    { sha256: "d".repeat(64) },
  ]) {
    const changed = files.map((file, index) => index === 2 ? { ...file, ...change } : file);
    assert.notEqual(await digestCanonicalPublishManifest(base), await digestCanonicalPublishManifest(canonicalizeDeclaredPublishManifest(changed)));
  }
});

test("case-insensitive duplicates and invalid paths are rejected", () => {
  assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([...files, { ...files[2], path: "assets/App.js" }])), "DUPLICATE_MANIFEST_PATH");
  for (const path of ["/index.html", "../index.html", "assets/../index.html", "assets\\app.js", "assets:app.js", ""]) {
    assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([{ ...files[1], path }])), "INVALID_MANIFEST_PATH");
  }
});

test("invalid sizes, hashes, empty manifests, and missing entry point are rejected", () => {
  for (const sizeBytes of [Number.NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 2 * 1024 * 1024 + 1]) {
    assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([{ ...files[1], sizeBytes }])), "INVALID_MANIFEST_SIZE");
  }
  for (const sha256 of ["a".repeat(63), "a".repeat(65), "g".repeat(64), `${"a".repeat(63)} `]) {
    assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([{ ...files[1], sha256 }])), "INVALID_MANIFEST_SHA256");
  }
  assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([])), "EMPTY_MANIFEST");
  assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([files[2]])), "MISSING_ENTRY_POINT");
  assert.equal(codeOf(() => canonicalizeDeclaredPublishManifest([{ ...files[1], path: "INDEX.HTML" }])), "MISSING_ENTRY_POINT");
});

test("declared uppercase hashes canonicalize without claiming content verification", () => {
  const manifest = canonicalizeDeclaredPublishManifest([{ ...files[1], sha256: HTML_HASH.toUpperCase(), contentType: " text/html " }]);
  assert.equal(manifest.files[0]?.sha256, HTML_HASH);
  assert.equal(manifest.files[0]?.contentType, "text/html");
});
