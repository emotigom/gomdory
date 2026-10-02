import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createClientPublishPrepareEvidence,
  type PublishUploadSource,
} from "@/lib/edu/publish/clientPrepareEvidence";
import { PublishManifestContractError } from "@/lib/edu/publish/manifest";

const HTML = "<!doctype html>";
const JAVASCRIPT = "console.log(1);";
const CSS = "body{color:red}";
const THUMBNAIL_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const encoder = new TextEncoder();

const HTML_SHA256 = "fe26c59e91ac8de694b2531dc3bdc1b7faf471d3d7e4e00870af60f5f22897cb";
const JAVASCRIPT_SHA256 = "35c146f76e129477c64061bc84511e1090f3d4d8059713e6663dd4b35b1f7642";
const CSS_SHA256 = "15c42ab7768d955ec0667195e339104557827893b16cc3e7412c76e7c2fcd371";
const THUMBNAIL_SHA256 = createHash("sha256").update(THUMBNAIL_BYTES).digest("hex");
const GOLDEN_MANIFEST_DIGEST = "a9d7adf9515f23753167acfce6b36f5b9086976d94af4b0f8d0dc627236ccde1";

function textSource(path: string, contentType: string, body: string): PublishUploadSource {
  return { path, contentType, body };
}

function sources(): PublishUploadSource[] {
  return [
    textSource("index.html", "text/html", HTML),
    textSource("assets/app.js", "text/javascript", JAVASCRIPT),
    textSource("assets/style.css", "text/css", CSS),
    { path: "thumb.png", contentType: "image/png", body: new Blob([THUMBNAIL_BYTES], { type: "image/png" }) },
  ];
}

function fileByPath(evidence: Awaited<ReturnType<typeof createClientPublishPrepareEvidence>>, path: string) {
  const file = evidence.declaredManifest.files.find((candidate) => candidate.path === path);
  assert.ok(file, `missing manifest file ${path}`);
  return file;
}

test("creates prepare evidence from exact text and Blob upload bytes", async () => {
  const evidence = await createClientPublishPrepareEvidence(sources());

  assert.equal(evidence.manifestSchemaVersion, 1);
  assert.deepEqual(evidence.files, [
    { path: "assets/app.js", contentType: "text/javascript", sizeBytes: 15 },
    { path: "assets/style.css", contentType: "text/css", sizeBytes: 15 },
    { path: "index.html", contentType: "text/html", sizeBytes: 15 },
    { path: "thumb.png", contentType: "image/png", sizeBytes: 9 },
  ]);
  assert.equal(fileByPath(evidence, "index.html").sha256, HTML_SHA256);
  assert.equal(fileByPath(evidence, "assets/app.js").sha256, JAVASCRIPT_SHA256);
  assert.equal(fileByPath(evidence, "assets/style.css").sha256, CSS_SHA256);
  assert.equal(fileByPath(evidence, "thumb.png").sha256, THUMBNAIL_SHA256);
  assert.equal(fileByPath(evidence, "thumb.png").sizeBytes, THUMBNAIL_BYTES.byteLength);
  assert.equal(evidence.declaredManifestDigest, GOLDEN_MANIFEST_DIGEST);
});

test("canonicalizes input order without returning raw source content", async () => {
  const original = sources();
  const first = await createClientPublishPrepareEvidence(original);
  const second = await createClientPublishPrepareEvidence(original.slice().reverse());

  assert.deepEqual(first.files, second.files);
  assert.equal(first.declaredManifestDigest, second.declaredManifestDigest);
  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes(HTML), false);
  assert.equal(serialized.includes(JAVASCRIPT), false);
  assert.equal(serialized.includes(CSS), false);
  assert.equal(serialized.includes("137,80,78,71"), false);
});

test("preserves exact text bytes and detects Blob byte changes", async () => {
  const lf = await createClientPublishPrepareEvidence([textSource("index.html", "text/html", "<!doctype html>\n")]);
  const crlf = await createClientPublishPrepareEvidence([textSource("index.html", "text/html", "<!doctype html>\r\n")]);
  const original = await createClientPublishPrepareEvidence(sources());
  const changed = sources();
  changed[3] = { ...changed[3], body: new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02])], { type: "image/png" }) };
  const changedEvidence = await createClientPublishPrepareEvidence(changed);

  assert.notEqual(lf.declaredManifestDigest, crlf.declaredManifestDigest);
  assert.notEqual(fileByPath(original, "thumb.png").sha256, fileByPath(changedEvidence, "thumb.png").sha256);
  assert.notEqual(original.declaredManifestDigest, changedEvidence.declaredManifestDigest);
});

test("supports Uint8Array without mutating the caller's bytes", async () => {
  const bytes = encoder.encode(HTML);
  const before = bytes.slice();
  const evidence = await createClientPublishPrepareEvidence([
    { path: "index.html", contentType: "text/html", body: bytes },
  ]);

  assert.equal(fileByPath(evidence, "index.html").sizeBytes, bytes.byteLength);
  assert.deepEqual(bytes, before);
});

test("rejects invalid source shapes through the manifest contract", async () => {
  await assert.rejects(
    () => createClientPublishPrepareEvidence([
      { path: "assets/app.js", contentType: "text/javascript", body: "missing entry point" },
    ]),
    (error: unknown) => error instanceof PublishManifestContractError && error.code === "MISSING_ENTRY_POINT",
  );
  await assert.rejects(
    () => createClientPublishPrepareEvidence([
      { path: "index.html", contentType: "text/html", body: "ok" },
      { path: "index.html", contentType: "text/html", body: "duplicate" },
    ]),
    (error: unknown) => error instanceof PublishManifestContractError && error.code === "DUPLICATE_MANIFEST_PATH",
  );
  await assert.rejects(
    () => createClientPublishPrepareEvidence([
      { path: "../index.html", contentType: "text/html", body: "bad" },
    ]),
    (error: unknown) => error instanceof PublishManifestContractError && error.code === "INVALID_MANIFEST_PATH",
  );
  await assert.rejects(
    () => createClientPublishPrepareEvidence([
      { path: "index.html", contentType: "text/html", body: 123 as unknown as string },
    ]),
    (error: unknown) => error instanceof Error && error.message === "UNSUPPORTED_PUBLISH_UPLOAD_BODY",
  );
});
