import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { strToU8, zipSync } from "fflate";

import {
  importStudentStaticSiteZip,
  STUDENT_APP_ZIP_MAX_BYTES,
  STUDENT_APP_ZIP_MAX_FILES,
} from "@/lib/student-apps/clientZipImport";

function zipFile(entries: Record<string, string | Uint8Array>, name = "site.zip"): File {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(entries).map(([path, content]) => [path, typeof content === "string" ? strToU8(content) : content])),
  );
  return new File([zipped], name, { type: "application/zip" });
}

test("imports a root-level static site ZIP into manual files", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "index.html": "<html><head><link rel=\"stylesheet\" href=\"style.css\"></head><body><script src=\"script.js\"></script></body></html>",
    "style.css": "body { color: red; }",
    "script.js": "console.log('ok')",
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.files.map((file) => file.path).sort(), ["index.html", "script.js", "style.css"]);
  assert.equal(result.files.some((file) => file.contentText?.includes("<html>")), true);
  assert.match(result.message, /기존 제출 흐름/);
});

test("imports a single-root-folder static site ZIP as root files", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "my-app/index.html": "<html><body><img src=\"images/logo.png\"><script src=\"script.js\"></script></body></html>",
    "my-app/style.css": "body { color: red; }",
    "my-app/script.js": "console.log('ok')",
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.files.map((file) => file.path).sort(), ["index.html", "script.js", "style.css"]);
});

test("imports image and JSON static assets", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "index.html": "<html><body><img src=\"images/logo.png\"><script src=\"script.js\"></script></body></html>",
    "script.js": "fetch('assets/data.json')",
    "images/logo.png": new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    "assets/data.json": "{\"title\":\"수업 샘플\"}",
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const logo = result.files.find((file) => file.path === "images/logo.png");
  const data = result.files.find((file) => file.path === "assets/data.json");
  assert.equal(logo?.contentType, "image/png");
  assert.equal(typeof logo?.contentBase64, "string");
  assert.equal(data?.contentType, "application/json");
  assert.equal(data?.contentText, "{\"title\":\"수업 샘플\"}");
});

test("rejects ZIPs without index.html using easy Korean copy", async () => {
  const result = await importStudentStaticSiteZip(zipFile({ "style.css": "body{}" }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.message, "index.html을 찾을 수 없어요. ZIP 안에 index.html 파일을 넣어주세요.");
});

test("rejects ambiguous index.html placement across multiple folders", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "my-app/index.html": "<html></html>",
    "other/style.css": "body{}",
  }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /index\.html 위치가 애매/);
});

test("rejects build project ZIP signals with specific guidance", async () => {
  const cases: Array<[Record<string, string>, RegExp]> = [
    [{ "package.json": "{}", "index.html": "<html></html>" }, /빌드 프로젝트 ZIP은 지원하지 않아요/],
    [{ "next.config.js": "module.exports = {}", "index.html": "<html></html>" }, /Next\.js 프로젝트 ZIP은 아직 지원하지 않아요/],
    [{ "vite.config.ts": "export default {}", "index.html": "<html></html>" }, /Vite 프로젝트 ZIP은 아직 자동 빌드하지 않아요/],
  ];

  for (const [entries, expected] of cases) {
    const result = await importStudentStaticSiteZip(zipFile(entries));
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.match(result.message, expected);
  }
});

test("rejects node_modules, secrets, and unsafe paths", async () => {
  const cases: Array<[Record<string, string>, RegExp]> = [
    [{ "index.html": "<html></html>", "node_modules/demo/index.js": "x" }, /node_modules 폴더는 넣지 말아주세요/],
    [{ "index.html": "<html></html>", ".env": "SECRET=x" }, /\.env나 비밀 키 파일/],
    [{ "index.html": "<html></html>", "assets/secret.key": "SECRET=x" }, /비밀 키 파일이나 실행 파일/],
    [{ "index.html": "<html></html>", "../evil.js": "x" }, /안전하지 않은 파일 경로/],
    [{ "index.html": "<html></html>", "/absolute.js": "x" }, /안전하지 않은 파일 경로/],
    [{ "index.html": "<html></html>", "bad\u0000name.js": "x" }, /안전하지 않은 파일 경로/],
  ];

  for (const [entries, expected] of cases) {
    const result = await importStudentStaticSiteZip(zipFile(entries));
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.match(result.message, expected);
  }
});

test("excludes nested ZIP files while importing the remaining static site", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "index.html": "<html></html>",
    "style.css": "body{}",
    "original/archive.zip": "PK",
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.files.map((file) => file.path).sort(), ["index.html", "style.css"]);
  assert.deepEqual(result.ignoredFiles, ["original/archive.zip"]);
  assert.match(result.message, /제외했어요/);
});

test("imports the same classroom static asset extensions as server validation", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "index.html": "<html></html>", "app.mjs": "export {}", "app.map": "{}", "notes.md": "# note",
    "site.webmanifest": "{}", "favicon.ico": new Uint8Array([0]), "assets/movie.mp4": new Uint8Array([0]),
    "assets/movie.webm": new Uint8Array([0]), "fonts/class.otf": new Uint8Array([0]),
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.files.find((file) => file.path === "assets/movie.mp4")?.contentType, "video/mp4");
  assert.equal(result.files.find((file) => file.path === "site.webmanifest")?.contentType, "application/manifest+json");
});

test("documents and enforces ZIP file count and 20MB limits", async () => {
  assert.equal(STUDENT_APP_ZIP_MAX_FILES, 100);
  assert.equal(STUDENT_APP_ZIP_MAX_BYTES, 20 * 1024 * 1024);

  const tooManyFiles = Object.fromEntries(
    Array.from({ length: STUDENT_APP_ZIP_MAX_FILES + 1 }, (_, index) => [`file-${index}.txt`, "x"]),
  );
  tooManyFiles["index.html"] = "<html></html>";
  const tooManyResult = await importStudentStaticSiteZip(zipFile(tooManyFiles));
  assert.equal(tooManyResult.ok, false);
  if (!tooManyResult.ok) assert.match(tooManyResult.message, /100개 이하/);

  const tooLargeResult = await importStudentStaticSiteZip(zipFile({
    "index.html": "<html></html>",
    "assets/large.txt": "x".repeat(STUDENT_APP_ZIP_MAX_BYTES + 1),
  }));
  assert.equal(tooLargeResult.ok, false);
  if (!tooLargeResult.ok) assert.match(tooLargeResult.message, /20MB 이하/);
});

test("imports MIDI assets with the same canonical content type as direct files", async () => {
  const result = await importStudentStaticSiteZip(zipFile({
    "index.html": "<html><body>music</body></html>",
    "assets/theme.MIDI": new Uint8Array([77, 84, 104, 100]),
  }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.files.find((file) => file.path === "assets/theme.MIDI")?.contentType, "audio/midi");
});

test("client ZIP helper does not statically import ZIP libraries", () => {
  const source = readFileSync("lib/student-apps/clientZipImport.ts", "utf8");
  const publicImporter = readFileSync("public/student-app-zip-import.mjs", "utf8");
  assert.match(source, /webpackIgnore/);
  assert.match(source, /\/student-app-zip-import\.mjs/);
  assert.doesNotMatch(source, /zip_eocd_missing|CENTRAL_DIRECTORY_SIGNATURE|deflate-raw/);
  assert.match(publicImporter, /DecompressionStream/);
  assert.match(publicImporter, /이 브라우저에서는 ZIP 가져오기를 사용할 수 없어요\. HTML\/CSS\/JS를 직접 붙여넣어 주세요\./);
  assert.doesNotMatch(source, /from\s+["']fflate["']|import\(["']fflate["']\)|require\(["']fflate["']\)/);
  assert.doesNotMatch(source, /from\s+["']jszip["']|import\(["']jszip["']\)|require\(["']jszip["']\)/i);
  assert.doesNotMatch(publicImporter, /from\s+["']fflate["']|import\(["']fflate["']\)|require\(["']fflate["']\)/);
  assert.doesNotMatch(publicImporter, /from\s+["']jszip["']|import\(["']jszip["']\)|require\(["']jszip["']\)/i);
});

test("shows an easy fallback when ZIP import is unavailable in the browser", async () => {
  const original = globalThis.DecompressionStream;
  Object.defineProperty(globalThis, "DecompressionStream", { configurable: true, value: undefined });
  try {
    const result = await importStudentStaticSiteZip(zipFile({ "index.html": "<html></html>" }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "이 브라우저에서는 ZIP 가져오기를 사용할 수 없어요. HTML/CSS/JS를 직접 붙여넣어 주세요.");
    }
  } finally {
    Object.defineProperty(globalThis, "DecompressionStream", { configurable: true, value: original });
  }
});
