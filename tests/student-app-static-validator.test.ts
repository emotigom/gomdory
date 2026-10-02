import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateStudentStaticApp } from "@/lib/student-apps/staticAppValidator";

const baseInput = {
  title: "Student Demo",
  source: "zip_upload" as const,
};

test("accepts minimal index.html", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [{ path: "index.html", content: "<html><body>Hello</body></html>" }],
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.entryFile, "index.html");
  assert.equal(result.manifest.files.length, 1);
});

test("rejects missing index.html", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [{ path: "main.js", content: "console.log('x')" }],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /missing_index_html/);
});

test("rejects path traversal", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [{ path: "../index.html", content: "x" }, { path: "index.html", content: "ok" }],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /invalid_path/);
});

test("rejects disallowed extensions", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "ok" },
      { path: "malware.sh", content: "echo nope" },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /dangerous_file/);
  assert.ok(result.manifest.safety.blockedReasons.some((x) => x.includes("dangerous_file")));
});

test("automatically excludes system files before validation", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "<html><body>Lesson 14</body></html>" },
      { path: "style.css", content: "body { color: black; }" },
      { path: "script.js", content: "console.log('ready')" },
      { path: ".DS_Store", content: "metadata" },
      { path: "assets/Thumbs.db", content: "metadata" },
      { path: "__MACOSX/assets/file", content: "metadata" },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.manifest.files.map((file) => file.path),
    ["index.html", "script.js", "style.css"],
  );
  assert.ok(result.manifest.safety.warnings.includes("skipped_system_file:.DS_Store"));
  assert.ok(result.manifest.safety.warnings.includes("skipped_system_file:assets/Thumbs.db"));
});

test("excludes safe originals from the manifest without blocking a valid app", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "<html></html>" },
      { path: "poster.psd", content: new Uint8Array([1]) },
      { path: "download.zip", content: new Uint8Array([2]) },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.files.map((file) => file.path), ["index.html"]);
  assert.ok(result.manifest.safety.warnings.includes("ignored_safe_file:poster.psd"));
  assert.ok(result.manifest.safety.warnings.includes("ignored_safe_file:download.zip"));
});

test("keeps dangerous extensions blocked when system files are skipped", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "ok" },
      { path: ".DS_Store", content: "metadata" },
      { path: "malware.exe", content: "nope" },
    ],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /dangerous_file:malware\.exe/);
  assert.ok(result.manifest.safety.warnings.includes("skipped_system_file:.DS_Store"));
});

test("accepts class media, font, nested, Korean and blank-MIME assets", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "ok" },
      { path: "assets/audio.mp3", content: new Uint8Array([1]) },
      { path: "assets/effect.wav", content: new Uint8Array([2]) },
      { path: "assets/song.m4a", content: new Uint8Array([3]) },
      { path: "assets/sound.ogg", content: new Uint8Array([4]) },
      { path: "assets/효과음.aac", content: new Uint8Array([5]) },
      { path: "assets/테마.MIDI", content: new Uint8Array([77, 84, 104, 100]) },
      { path: "assets/글꼴/my font.WOFF2", content: new Uint8Array([6]) },
      { path: "assets/글꼴/손글씨.ttf", content: new Uint8Array([7]) },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.files.length, 9);
});

test("accepts a 10–20MB nested class project with image and audio", async () => {
  const classAsset = new Uint8Array(6 * 1024 * 1024);
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "<link rel='stylesheet' href='assets/style.css'><script src='assets/script.js'></script>" },
      { path: "assets/style.css", content: "body { color: rebeccapurple; }" },
      { path: "assets/script.js", content: "console.log('ready')" },
      { path: "assets/images/배경.png", content: classAsset },
      { path: "assets/audio/theme.m4a", content: classAsset },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.manifest.totalSizeBytes > 10 * 1024 * 1024);
  assert.ok(result.manifest.totalSizeBytes < 20 * 1024 * 1024);
});

test("accepts video while rejecting mismatched MIME and an individual file over 15MB", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "ok" },
      { path: "video/demo.mp4", content: new Uint8Array([1]) },
      { path: "image.png", contentType: "audio/mpeg", content: new Uint8Array([2]) },
      { path: "large/music.wav", content: new Uint8Array(15 * 1024 * 1024 + 1) },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.doesNotMatch(result.errors.join(","), /video\/demo\.mp4/);
  assert.match(result.errors.join(","), /mime_type_mismatch:image\.png/);
  assert.match(result.errors.join(","), /file_too_large:large\/music\.wav/);
});

test("rejects over file count", async () => {
  const many = Array.from({ length: 101 }, (_, i) => ({ path: `file-${i}.txt`, content: "a" }));
  many[0] = { path: "index.html", content: "ok" };
  const result = await validateStudentStaticApp({ ...baseInput, files: many });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /file_count_exceeds_limit/);
});

test("does not count safe ignored originals toward the 100 submitted-file limit", async () => {
  const files = [
    { path: "index.html", content: "ok" },
    ...Array.from({ length: 99 }, (_, i) => ({ path: `assets/file-${i}.txt`, content: "a" })),
    { path: "poster.psd", content: "source" },
  ];
  const result = await validateStudentStaticApp({ ...baseInput, files });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.manifest.files.length, 100);
});

test("rejects over total size", async () => {
  const largeAsset = new Uint8Array(11 * 1024 * 1024);
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [
      { path: "index.html", content: "ok" },
      { path: "assets/a.mp3", content: largeAsset },
      { path: "assets/b.mp3", content: largeAsset },
      { path: "assets/c.mp3", content: largeAsset },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(","), /total_size_exceeds_limit/);
});

test("warns on external script", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [{ path: "index.html", content: '<script src="https://example.com/a.js"></script>' }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.safety.hasExternalScripts, true);
});

test("warns on form action", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [{ path: "index.html", content: '<form action="/submit"></form>' }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.safety.hasForms, true);
});

test("warns on fetch/WebSocket", async () => {
  const result = await validateStudentStaticApp({
    ...baseInput,
    files: [{ path: "index.html", content: "<script>fetch('/x'); new WebSocket('wss://x')</script>" }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.safety.hasNetworkRequests, true);
});

test("produces deterministic sha256 metadata", async () => {
  const input = {
    ...baseInput,
    createdAt: "2026-01-01T00:00:00.000Z",
    files: [
      { path: "z.txt", content: "zzz" },
      { path: "index.html", content: "abc" },
    ],
  };

  const a = await validateStudentStaticApp(input);
  const b = await validateStudentStaticApp(input);

  assert.deepEqual(a, b);
  assert.equal(a.ok, true);
  if (!a.ok) return;
  assert.equal(
    a.manifest.files.find((f) => f.path === "index.html")?.sha256,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});


test("validator source uses WebCrypto and avoids node:crypto", () => {
  const source = readFileSync("lib/student-apps/staticAppValidator.ts", "utf8");
  assert.equal(source.includes("node:crypto"), false);
  assert.equal(source.includes("createHash"), false);
  assert.equal(source.includes("globalThis.crypto") || source.includes("crypto.subtle.digest"), true);
});
