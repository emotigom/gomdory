import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { putStudentAppFilesToR2 } from "@/lib/student-apps/studentAppR2Storage";

test("writes files and manifest with metadata", async () => {
  const puts: Array<{ key: string; value: unknown; options?: R2PutOptions }> = [];
  const bucket = {
    put: async (key: string, value: unknown, options?: R2PutOptions) => {
      puts.push({ key, value, options });
      return {} as R2Object;
    },
  } as unknown as R2Bucket;

  const manifest = {
    version: 1 as const,
    title: "App",
    entryFile: "index.html" as const,
    files: [
      { path: "index.html", sizeBytes: 12, contentType: "text/html", sha256: "a".repeat(64) },
      { path: "assets/app.js", sizeBytes: 10, contentType: "application/javascript", sha256: "b".repeat(64) },
    ],
    totalSizeBytes: 22,
    createdAt: new Date().toISOString(),
    source: "manual_files" as const,
    safety: {
      hasExternalScripts: false,
      hasInlineScripts: false,
      hasForms: false,
      hasNetworkRequests: false,
      warnings: [],
      blockedReasons: [],
    },
  };

  const result = await putStudentAppFilesToR2({
    bucket,
    prefix: "student-apps/private/board/dep/v1/",
    files: [
      { path: "index.html", content: "<html></html>" },
      { path: "assets/app.js", content: "console.log(1);" },
    ],
    manifest,
  });

  assert.equal(puts.length, 3);
  assert.equal(result.manifestKey, "student-apps/private/board/dep/v1/manifest.json");
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0]?.r2Key, "student-apps/private/board/dep/v1/index.html");

  const indexPut = puts.find((p) => p.key.endsWith("index.html"));
  assert.equal(indexPut?.options?.httpMetadata?.contentType, "text/html");
  assert.equal(indexPut?.options?.customMetadata?.sha256, "a".repeat(64));
  assert.equal((indexPut?.options?.customMetadata as Record<string, string>).entryFile, "index.html");

  const manifestPut = puts.find((p) => p.key.endsWith("manifest.json"));
  assert.equal(manifestPut?.options?.httpMetadata?.contentType, "application/json");
  assert.equal(String(result).includes("http"), false);
});

test("throws when manifest file content is missing", async () => {
  const bucket = { put: async () => ({} as R2Object) } as unknown as R2Bucket;

  await assert.rejects(
    putStudentAppFilesToR2({
      bucket,
      prefix: "student-apps/private/board/dep/v1/",
      files: [{ path: "index.html", content: "ok" }],
      manifest: {
        version: 1,
        title: "App",
        entryFile: "index.html",
        files: [{ path: "missing.js", sizeBytes: 1, contentType: "application/javascript", sha256: "c".repeat(64) }],
        totalSizeBytes: 1,
        createdAt: new Date().toISOString(),
        source: "manual_files",
        safety: { hasExternalScripts: false, hasInlineScripts: false, hasForms: false, hasNetworkRequests: false, warnings: [], blockedReasons: [] },
      },
    }),
  );
});

test("storage helper source avoids disallowed runtime imports", () => {
  const source = readFileSync("lib/student-apps/studentAppR2Storage.ts", "utf8");
  assert.doesNotMatch(source, /cloudflare:env|node:crypto|node:buffer/);
});
