import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeclaredPublishManifestEvidence,
  type DeclaredPublishSourceFile,
} from "@/lib/edu/publish/declaredManifestEvidence";
import { PublishManifestContractError } from "@/lib/edu/publish/manifest";

const HTML = "<!doctype html>";
const JAVASCRIPT = "console.log(1);";
const CSS = "body{color:red}";

const HTML_SHA256 = "fe26c59e91ac8de694b2531dc3bdc1b7faf471d3d7e4e00870af60f5f22897cb";
const JAVASCRIPT_SHA256 = "35c146f76e129477c64061bc84511e1090f3d4d8059713e6663dd4b35b1f7642";
const CSS_SHA256 = "15c42ab7768d955ec0667195e339104557827893b16cc3e7412c76e7c2fcd371";
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const GOLDEN_SERIALIZED_MANIFEST =
  "{\"schemaVersion\":1,\"entryPoint\":\"index.html\",\"files\":[{\"path\":\"assets/app.js\",\"sizeBytes\":15,\"contentType\":\"text/javascript\",\"sha256\":\"35c146f76e129477c64061bc84511e1090f3d4d8059713e6663dd4b35b1f7642\"},{\"path\":\"assets/style.css\",\"sizeBytes\":15,\"contentType\":\"text/css\",\"sha256\":\"15c42ab7768d955ec0667195e339104557827893b16cc3e7412c76e7c2fcd371\"},{\"path\":\"index.html\",\"sizeBytes\":15,\"contentType\":\"text/html\",\"sha256\":\"fe26c59e91ac8de694b2531dc3bdc1b7faf471d3d7e4e00870af60f5f22897cb\"}]}";
const GOLDEN_MANIFEST_DIGEST = "e089f33e235fd6c4c40578b2cd5fd7d284a016499d30aa3331f1b44b06a40ba8";

const encoder = new TextEncoder();

function sourceFile(path: string, contentType: string, content: string): DeclaredPublishSourceFile {
  return { path, contentType, bytes: encoder.encode(content) };
}

function goldenFiles(): DeclaredPublishSourceFile[] {
  return [
    sourceFile("index.html", "text/html", HTML),
    sourceFile("assets/app.js", "text/javascript", JAVASCRIPT),
    sourceFile("assets/style.css", "text/css", CSS),
  ];
}

function fileByPath(evidence: Awaited<ReturnType<typeof createDeclaredPublishManifestEvidence>>, path: string) {
  const file = evidence.manifest.files.find((candidate) => candidate.path === path);
  assert.ok(file, `missing manifest file ${path}`);
  return file;
}

async function assertContractError(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof PublishManifestContractError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test("creates byte-based declared evidence with exact golden vectors", async () => {
  const evidence = await createDeclaredPublishManifestEvidence(goldenFiles());

  assert.deepEqual(evidence.manifest, {
    schemaVersion: 1,
    entryPoint: "index.html",
    files: [
      { path: "assets/app.js", sizeBytes: 15, contentType: "text/javascript", sha256: JAVASCRIPT_SHA256 },
      { path: "assets/style.css", sizeBytes: 15, contentType: "text/css", sha256: CSS_SHA256 },
      { path: "index.html", sizeBytes: 15, contentType: "text/html", sha256: HTML_SHA256 },
    ],
  });
  assert.equal(fileByPath(evidence, "index.html").sha256, HTML_SHA256);
  assert.equal(fileByPath(evidence, "assets/app.js").sha256, JAVASCRIPT_SHA256);
  assert.equal(fileByPath(evidence, "assets/style.css").sha256, CSS_SHA256);
  for (const file of evidence.manifest.files) {
    assert.equal(file.sizeBytes, goldenFiles().find((source) => source.path === file.path)?.bytes.byteLength);
  }
  assert.equal(evidence.serializedManifest, GOLDEN_SERIALIZED_MANIFEST);
  assert.equal(evidence.declaredManifestDigest, GOLDEN_MANIFEST_DIGEST);
});

test("is independent of input order and does not mutate source inputs", async () => {
  const files = goldenFiles();
  const before = files.map((file) => ({
    path: file.path,
    contentType: file.contentType,
    bytes: Array.from(file.bytes),
  }));
  const first = await createDeclaredPublishManifestEvidence(files);
  const second = await createDeclaredPublishManifestEvidence(files.slice().reverse());

  assert.equal(first.serializedManifest, second.serializedManifest);
  assert.equal(first.declaredManifestDigest, second.declaredManifestDigest);
  assert.deepEqual(files.map((file) => ({
    path: file.path,
    contentType: file.contentType,
    bytes: Array.from(file.bytes),
  })), before);
});

test("changes the affected hash and manifest digest when one byte changes", async () => {
  const original = await createDeclaredPublishManifestEvidence(goldenFiles());
  const changedFiles = goldenFiles();
  const app = changedFiles.find((file) => file.path === "assets/app.js");
  assert.ok(app);
  app.bytes[0] ^= 1;
  const changed = await createDeclaredPublishManifestEvidence(changedFiles);

  assert.notEqual(fileByPath(changed, "assets/app.js").sha256, JAVASCRIPT_SHA256);
  assert.equal(fileByPath(changed, "assets/style.css").sha256, CSS_SHA256);
  assert.notEqual(changed.declaredManifestDigest, original.declaredManifestDigest);
});

test("preserves byte distinctions such as LF versus CRLF and BOM", async () => {
  const lf = await createDeclaredPublishManifestEvidence([
    sourceFile("index.html", "text/html", "<!doctype html>\n"),
  ]);
  const crlf = await createDeclaredPublishManifestEvidence([
    sourceFile("index.html", "text/html", "<!doctype html>\r\n"),
  ]);
  const withoutBom = await createDeclaredPublishManifestEvidence([
    sourceFile("index.html", "text/html", "<!doctype html>"),
  ]);
  const withBom = await createDeclaredPublishManifestEvidence([
    sourceFile("index.html", "text/html", "\uFEFF<!doctype html>"),
  ]);

  assert.notEqual(fileByPath(lf, "index.html").sha256, fileByPath(crlf, "index.html").sha256);
  assert.notEqual(lf.declaredManifestDigest, crlf.declaredManifestDigest);
  assert.notEqual(fileByPath(withoutBom, "index.html").sha256, fileByPath(withBom, "index.html").sha256);
  assert.notEqual(withoutBom.declaredManifestDigest, withBom.declaredManifestDigest);
});

test("keeps content hash stable while metadata changes the manifest digest", async () => {
  const original = await createDeclaredPublishManifestEvidence(goldenFiles());
  const changedPathFiles = goldenFiles();
  const changedPath = changedPathFiles.find((file) => file.path === "assets/app.js");
  assert.ok(changedPath);
  changedPath.path = "assets/main.js";
  const changedPathEvidence = await createDeclaredPublishManifestEvidence(changedPathFiles);

  const changedMimeFiles = goldenFiles();
  const changedMime = changedMimeFiles.find((file) => file.path === "assets/app.js");
  assert.ok(changedMime);
  changedMime.contentType = "application/javascript";
  const changedMimeEvidence = await createDeclaredPublishManifestEvidence(changedMimeFiles);

  assert.equal(fileByPath(original, "assets/app.js").sha256, fileByPath(changedPathEvidence, "assets/main.js").sha256);
  assert.equal(fileByPath(original, "assets/app.js").sha256, fileByPath(changedMimeEvidence, "assets/app.js").sha256);
  assert.notEqual(original.declaredManifestDigest, changedPathEvidence.declaredManifestDigest);
  assert.notEqual(original.declaredManifestDigest, changedMimeEvidence.declaredManifestDigest);
});

test("canonicalizes composed and decomposed NFC paths identically", async () => {
  const decomposed = await createDeclaredPublishManifestEvidence([
    sourceFile("index.html", "text/html", HTML),
    sourceFile("assets/café.css", "text/css", CSS),
  ]);
  const composed = await createDeclaredPublishManifestEvidence([
    sourceFile("index.html", "text/html", HTML),
    sourceFile("assets/café.css", "text/css", CSS),
  ]);

  assert.equal(fileByPath(decomposed, "assets/café.css").sha256, CSS_SHA256);
  assert.equal(decomposed.serializedManifest, composed.serializedManifest);
  assert.equal(decomposed.declaredManifestDigest, composed.declaredManifestDigest);
});

test("passes existing manifest validation errors through unchanged", async () => {
  await assertContractError(
    () => createDeclaredPublishManifestEvidence([sourceFile("assets/app.js", "text/javascript", JAVASCRIPT)]),
    "MISSING_ENTRY_POINT",
  );
  await assertContractError(
    () => createDeclaredPublishManifestEvidence([
      sourceFile("index.html", "text/html", HTML),
      sourceFile("INDEX.html", "text/html", HTML),
    ]),
    "DUPLICATE_MANIFEST_PATH",
  );
  await assertContractError(
    () => createDeclaredPublishManifestEvidence([sourceFile("../index.html", "text/html", HTML)]),
    "INVALID_MANIFEST_PATH",
  );
  await assertContractError(
    () => createDeclaredPublishManifestEvidence([
      { path: "index.html", contentType: "text/html", bytes: new Uint8Array(2 * 1024 * 1024 + 1) },
    ]),
    "INVALID_MANIFEST_SIZE",
  );

  const overTotalSize = Math.floor(8 * 1024 * 1024 / 5) + 1;
  await assertContractError(
    () => createDeclaredPublishManifestEvidence([
      { path: "index.html", contentType: "text/html", bytes: new Uint8Array(overTotalSize) },
      { path: "assets/a.js", contentType: "text/javascript", bytes: new Uint8Array(overTotalSize) },
      { path: "assets/b.js", contentType: "text/javascript", bytes: new Uint8Array(overTotalSize) },
      { path: "assets/c.js", contentType: "text/javascript", bytes: new Uint8Array(overTotalSize) },
      { path: "assets/d.js", contentType: "text/javascript", bytes: new Uint8Array(overTotalSize) },
    ]),
    "INVALID_MANIFEST_SIZE",
  );
});

test("rejects runtime-invalid byte representations with a fixed contract error", async () => {
  const base = { path: "index.html", contentType: "text/html" };
  for (const bytes of [null, new ArrayBuffer(0), "<!doctype html>"]) {
    await assertContractError(
      () => createDeclaredPublishManifestEvidence([{ ...base, bytes } as unknown as DeclaredPublishSourceFile]),
      "INVALID_MANIFEST_BYTES",
    );
  }
});

test("hashes an allowed empty file as the SHA-256 empty digest", async () => {
  const evidence = await createDeclaredPublishManifestEvidence([
    { path: "index.html", contentType: "text/html", bytes: new Uint8Array(0) },
  ]);

  assert.equal(fileByPath(evidence, "index.html").sizeBytes, 0);
  assert.equal(fileByPath(evidence, "index.html").sha256, EMPTY_SHA256);
});
